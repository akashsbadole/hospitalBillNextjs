import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── Schemas ──────────────────────────────────────────────────────────────
const updatePaymentSchema = z.object({
  status: z.enum(['Pending', 'Success', 'Failed', 'Refunded']),
})

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/payments')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 })
    }

    const payment = await db.payment.findUnique({
      where: { id },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            grandTotal: true,
            paidAmount: true,
            status: true,
          },
        },
        patient: {
          select: {
            id: true,
            patientId: true,
            name: true,
            phone: true,
          },
        },
      },
    })

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    return NextResponse.json({ data: payment })
  } catch (error) {
    console.error('[PAYMENT_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch payment', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── PUT (for refund processing) ─────────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/payments')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updatePaymentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await db.payment.findUnique({
      where: { id },
      include: { invoice: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    const newStatus = parsed.data.status

    // Validate status transitions
    if (existing.status === newStatus) {
      return NextResponse.json({ error: `Payment is already ${newStatus}` }, { status: 400 })
    }

    if (existing.status === 'Refunded') {
      return NextResponse.json({ error: 'Cannot modify a refunded payment' }, { status: 400 })
    }

    // Handle refund: update payment status and adjust invoice
    if (newStatus === 'Refunded') {
      const result = await db.$transaction(async (tx) => {
        const updatedPayment = await tx.payment.update({
          where: { id },
          data: { status: 'Refunded' },
        })

        // Recalculate paid amount (excluding refunded payments)
        const successfulPayments = await tx.payment.findMany({
          where: { invoiceId: existing.invoiceId, status: 'Success' },
        })
        const newPaidAmount = successfulPayments.reduce((sum, p) => sum + p.amount, 0)

        const invoiceStatus = newPaidAmount <= 0
          ? 'Unpaid'
          : newPaidAmount >= existing.invoice.grandTotal
            ? 'Paid'
            : 'Partially Paid'

        await tx.invoice.update({
          where: { id: existing.invoiceId },
          data: {
            paidAmount: newPaidAmount,
            status: invoiceStatus,
          },
        })

        return { payment: updatedPayment, invoiceStatus }
      })

      logAudit({
        userId: auth.user!.id,
        userName: auth.user!.email,
        userEmail: auth.user!.email,
        userRole: auth.role!,
        action: 'STATUS_CHANGE',
        module: 'payments',
        details: {
          paymentId: id,
          amount: existing.amount,
          method: existing.method,
          statusChange: `${existing.status} → Refunded`,
          invoiceId: existing.invoiceId,
          newInvoiceStatus: result.invoiceStatus,
        },
        ...extractRequestInfo(request),
      })

      return NextResponse.json({ data: result.payment, invoiceStatus: result.invoiceStatus })
    }

    // For other status transitions (Success/Failed/Pending)
    const updated = await db.payment.update({
      where: { id },
      data: { status: newStatus },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'UPDATE',
      module: 'payments',
      details: {
        paymentId: id,
        amount: existing.amount,
        method: existing.method,
        statusChange: `${existing.status} → ${newStatus}`,
        invoiceId: existing.invoiceId,
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[PAYMENT_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update payment', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// No DELETE — payments are immutable, use status Refunded instead
