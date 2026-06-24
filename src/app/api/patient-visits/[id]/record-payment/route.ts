import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generatePaymentId } from '@/lib/utils'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'
import { VISIT_STAGES } from '../../route'

// ── Schemas ──────────────────────────────────────────────────────────────
const recordPaymentSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0'),
  method: z.enum(['Cash', 'UPI', 'Card', 'Net Banking', 'Wallet', 'Razorpay', 'PayPal']),
  razorpayPaymentId: z.string().trim().optional(),
  paypalCaptureId: z.string().trim().optional(),
})

// Helper: get stage index
function stageIndex(stage: string): number {
  return VISIT_STAGES.indexOf(stage as typeof VISIT_STAGES[number])
}

const BILLED_INDEX = stageIndex('Billed')
const PAID_INDEX = stageIndex('Paid')

// ── POST ─────────────────────────────────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/patient-visits')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    const body = await request.json()

    const parsed = recordPaymentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Fetch visit with patient and stages
    const visit = await db.patientVisit.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, patientId: true, name: true, phone: true } },
        stages: { orderBy: { createdAt: 'asc' } },
      },
    })

    if (!visit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 })
    }

    // Validate visit is active
    if (visit.status !== 'Active') {
      return NextResponse.json(
        { error: `Visit is ${visit.status.toLowerCase()}. Only active visits can record payments.` },
        { status: 400 }
      )
    }

    // Validate visit is at "Billed" stage
    const currentIdx = stageIndex(visit.stage)
    if (currentIdx < BILLED_INDEX) {
      return NextResponse.json(
        { error: 'Cannot record payment at this stage', details: `Visit must be at "Billed" stage. Current stage: ${visit.stage}` },
        { status: 400 }
      )
    }

    if (currentIdx >= PAID_INDEX) {
      return NextResponse.json(
        { error: 'Payment already recorded', details: `Visit is already at "${visit.stage}" stage` },
        { status: 400 }
      )
    }

    // Find the most recent unpaid invoice for this patient
    const invoice = await db.invoice.findFirst({
      where: {
        patientId: visit.patientId,
        status: { in: ['Unpaid', 'Partially Paid'] },
      },
      orderBy: { createdAt: 'desc' },
      include: { payments: { where: { status: 'Success' } } },
    })

    if (!invoice) {
      return NextResponse.json(
        { error: 'No pending invoice found', details: 'Cannot record payment without an invoice. Please create an invoice first.' },
        { status: 400 }
      )
    }

    // Transaction: create payment, update invoice, advance visit to "Paid"
    const result = await db.$transaction(async (tx) => {
      // Re-read invoice inside transaction to get fresh data (prevents race condition)
      const freshInvoice = await tx.invoice.findUnique({
        where: { id: invoice.id },
        include: { payments: { where: { status: 'Success' } } },
      })

      if (!freshInvoice) {
        throw new Error('Invoice not found')
      }

      if (freshInvoice.status === 'Cancelled') {
        throw new Error('Cannot pay a cancelled invoice')
      }
      if (freshInvoice.status === 'Paid') {
        throw new Error('Invoice is already fully paid')
      }

      const currentPaid = freshInvoice.payments.reduce((sum, p) => sum + p.amount, 0)
      const remainingBalance = parseFloat((freshInvoice.grandTotal - currentPaid).toFixed(2))

      if (data.amount > remainingBalance) {
        throw new Error(`Payment amount (₹${data.amount.toFixed(2)}) exceeds remaining balance (₹${remainingBalance.toFixed(2)})`)
      }

      // Auto-generate payment ID
      const lastPayment = await tx.payment.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { paymentId: true },
      })
      const paymentId = generatePaymentId(lastPayment?.paymentId ?? null)

      // Create payment
      const payment = await tx.payment.create({
        data: {
          paymentId,
          invoiceId: freshInvoice.id,
          patientId: visit.patientId,
          amount: data.amount,
          method: data.method,
          razorpayPaymentId: data.razorpayPaymentId ?? null,
          paypalCaptureId: data.paypalCaptureId ?? null,
          status: 'Success',
        },
      })

      // Update invoice paid amount and status
      const newPaidAmount = parseFloat((currentPaid + data.amount).toFixed(2))
      const newInvoiceStatus = newPaidAmount >= freshInvoice.grandTotal ? 'Paid' : 'Partially Paid'

      await tx.invoice.update({
        where: { id: freshInvoice.id },
        data: {
          paidAmount: newPaidAmount,
          status: newInvoiceStatus,
        },
      })

      // Advance visit stage: mark Billed as Completed, mark Paid as Active
      const billedStageRecord = visit.stages.find(s => s.stage === 'Billed' && s.status === 'Active')
      if (billedStageRecord) {
        await tx.visitStage.update({
          where: { id: billedStageRecord.id },
          data: {
            status: 'Completed',
            completedAt: new Date(),
            completedById: auth.user!.id,
            notes: `Payment ${paymentId} — ₹${data.amount.toFixed(2)} via ${data.method}`,
          },
        })
      }

      // Mark Paid stage as Active
      const paidStageRecord = visit.stages.find(s => s.stage === 'Paid' && s.status === 'Pending')
      if (paidStageRecord) {
        await tx.visitStage.update({
          where: { id: paidStageRecord.id },
          data: { status: 'Active' },
        })
      }

      // Update visit current stage
      const updatedVisit = await tx.patientVisit.update({
        where: { id },
        data: { stage: 'Paid' },
        include: {
          patient: { select: { id: true, patientId: true, name: true, phone: true } },
          stages: { orderBy: { createdAt: 'asc' } },
        },
      })

      return { payment, newPaidAmount, newInvoiceStatus, updatedVisit }
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'payments',
      details: {
        paymentId: result.payment.paymentId,
        invoiceId: invoice.id,
        patientId: visit.patient.patientId,
        patientName: visit.patient.name,
        visitId: visit.visitId,
        amount: data.amount,
        method: data.method,
      },
      ...extractRequestInfo(request),
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'STATUS_CHANGE',
      module: 'patient-visits',
      details: {
        visitId: visit.visitId,
        patientId: visit.patient.patientId,
        patientName: visit.patient.name,
        fromStage: visit.stage,
        toStage: 'Paid',
        reason: `Payment ${result.payment.paymentId} recorded — ₹${data.amount.toFixed(2)} via ${data.method}`,
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({
      data: result.payment,
      paidAmount: result.newPaidAmount,
      invoiceStatus: result.newInvoiceStatus,
      visit: result.updatedVisit,
    }, { status: 201 })
  } catch (error) {
    console.error('[VISIT_RECORD_PAYMENT]', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message.includes('exceeds remaining balance')) {
      return NextResponse.json({ error: 'Payment amount exceeds balance', details: message }, { status: 400 })
    }
    if (message.includes('not found') || message.includes('No pending invoice')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    return NextResponse.json(
      { error: 'Failed to record payment', details: message },
      { status: 500 }
    )
  }
}
