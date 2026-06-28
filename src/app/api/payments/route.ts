import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generatePaymentId } from '@/lib/utils'
import { authenticateRequest, checkWritePermission, getTenantFilter, getCreateBranchId } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'
import { errorDetails } from '@/lib/api-errors'

// ── Schemas ──────────────────────────────────────────────────────────────
const createPaymentSchema = z.object({
  invoiceId: z.string().trim().min(1, 'Invoice ID is required'),
  patientId: z.string().trim().min(1, 'Patient ID is required'),
  amount: z.number().positive('Amount must be greater than 0'),
  method: z.enum(['Cash', 'UPI', 'Card', 'Net Banking', 'Wallet', 'Razorpay', 'PayPal']),
  razorpayPaymentId: z.string().trim().optional(),
  razorpayOrderId: z.string().trim().optional(),
  razorpaySignature: z.string().trim().optional(),
  paypalOrderId: z.string().trim().optional(),
  paypalCaptureId: z.string().trim().optional(),
  receiptNumber: z.string().trim().optional(),
})

const VALID_STATUSES = ['Pending', 'Success', 'Failed', 'Refunded'] as const
const VALID_METHODS = ['Cash', 'UPI', 'Card', 'Net Banking', 'Wallet', 'Razorpay', 'PayPal'] as const

// ── Helpers ──────────────────────────────────────────────────────────────

async function generateReceiptNumber(tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]): Promise<string> {
  const today = new Date()
  const dateStr = today.getFullYear().toString() +
    String(today.getMonth() + 1).padStart(2, '0') +
    String(today.getDate()).padStart(2, '0')

  // Find payments created today with an auto-generated receipt number
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const todayEnd = new Date(todayStart)
  todayEnd.setDate(todayEnd.getDate() + 1)

  const todayPrefix = `RCP-${dateStr}-`
  const lastReceipt = await tx.payment.findFirst({
    where: {
      receiptNumber: { startsWith: todayPrefix },
    },
    orderBy: { receiptNumber: 'desc' },
    select: { receiptNumber: true },
  })

  let seq = 1
  if (lastReceipt?.receiptNumber) {
    const parts = lastReceipt.receiptNumber.split('-')
    const lastSeq = parseInt(parts[2] || '0', 10)
    if (!isNaN(lastSeq)) seq = lastSeq + 1
  }

  return `${todayPrefix}${String(seq).padStart(3, '0')}`
}

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/payments')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const status = searchParams.get('status')
    const method = searchParams.get('method')
    const patientId = searchParams.get('patientId')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    if (status && !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      return NextResponse.json(
        { error: 'Invalid status filter', details: `Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    if (method && !VALID_METHODS.includes(method as typeof VALID_METHODS[number])) {
      return NextResponse.json(
        { error: 'Invalid method filter', details: `Must be one of: ${VALID_METHODS.join(', ')}` },
        { status: 400 }
      )
    }

    const where: Record<string, unknown> = { ...getTenantFilter(auth.role, auth.branchId, request) }

    if (status) where.status = status
    if (method) where.method = method
    if (patientId) where.patientId = patientId
    if (fromDate || toDate) {
      const dateFilter: Record<string, unknown> = {}
      if (fromDate) dateFilter.gte = new Date(fromDate)
      if (toDate) dateFilter.lte = new Date(toDate + 'T23:59:59')
      where.createdAt = dateFilter
    }

    const [payments, total] = await Promise.all([
      db.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          invoice: { select: { id: true, invoiceNumber: true, grandTotal: true } },
          patient: { select: { id: true, patientId: true, name: true, phone: true } },
        },
      }),
      db.payment.count({ where }),
    ])

    return NextResponse.json({
      data: payments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[PAYMENTS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch payments', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── POST (transactional — no race condition) ────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/payments')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()

    const parsed = createPaymentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Check invoice and patient exist OUTSIDE transaction (read-only checks)
    const [invoice, patient] = await Promise.all([
      db.invoice.findUnique({ where: { id: data.invoiceId } }),
      db.patient.findUnique({ where: { id: data.patientId } }),
    ])

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }
    if (invoice.status === 'Cancelled') {
      return NextResponse.json({ error: 'Cannot pay a cancelled invoice' }, { status: 400 })
    }
    if (invoice.status === 'Paid') {
      return NextResponse.json({ error: 'Invoice is already fully paid' }, { status: 400 })
    }

    // ── CRITICAL: entire balance check + create + update in ONE transaction ──
    const result = await db.$transaction(async (tx) => {
      // Re-read invoice inside transaction to get fresh data (prevents race condition)
      const freshInvoice = await tx.invoice.findUnique({
        where: { id: data.invoiceId },
        include: { payments: { where: { status: 'Success' } } },
      })

      if (!freshInvoice) {
        throw new Error('Invoice not found')
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

      // Auto-generate receipt number if not provided
      const receiptNumber = data.receiptNumber || await generateReceiptNumber(tx)

      // Create payment
      const createBranchId = getCreateBranchId(auth.role, auth.branchId, request)
      const payment = await tx.payment.create({
        data: {
          paymentId,
          invoiceId: data.invoiceId,
          patientId: data.patientId,
          amount: data.amount,
          method: data.method,
          razorpayPaymentId: data.razorpayPaymentId ?? null,
          razorpayOrderId: data.razorpayOrderId ?? null,
          razorpaySignature: data.razorpaySignature ?? null,
          paypalOrderId: data.paypalOrderId ?? null,
          paypalCaptureId: data.paypalCaptureId ?? null,
          receiptNumber,
          status: 'Success',
          branchId: createBranchId,
        },
      })

      // Update invoice paid amount and status
      const newPaidAmount = parseFloat((currentPaid + data.amount).toFixed(2))
      const newStatus = newPaidAmount >= freshInvoice.grandTotal ? 'Paid' : 'Partially Paid'

      await tx.invoice.update({
        where: { id: data.invoiceId },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
        },
      })

      return { payment, newPaidAmount, newStatus }
    })

    logAudit({
      userId: auth.userId!,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'payments',
      details: { paymentId: result.payment.paymentId, invoiceId: data.invoiceId, amount: data.amount, method: data.method },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: result.payment, paidAmount: result.newPaidAmount, invoiceStatus: result.newStatus }, { status: 201 })
  } catch (error) {
    console.error('[PAYMENTS_POST]', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message.includes('exceeds remaining balance')) {
      return NextResponse.json({ error: 'Payment amount exceeds balance' }, { status: 400 })
    }
    if (message.includes('Invoice not found') || message.includes('not found')) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }
    return NextResponse.json(
      { error: 'Failed to create payment', details: errorDetails(error) },
      { status: 500 }
    )
  }
}