import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generatePaymentId } from '@/lib/utils'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'
import crypto from 'crypto'
import { decrypt } from '@/lib/crypto'

const verifySchema = z.object({
  razorpayOrderId: z.string().trim().min(1),
  razorpayPaymentId: z.string().trim().min(1),
  razorpaySignature: z.string().trim().min(1),
  invoiceId: z.string().trim().min(1),
  patientId: z.string().trim().min(1),
  amount: z.number().positive(),
})

// ── Helpers ──────────────────────────────────────────────────────────────

async function generateReceiptNumber(tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]): Promise<string> {
  const today = new Date()
  const dateStr = today.getFullYear().toString() +
    String(today.getMonth() + 1).padStart(2, '0') +
    String(today.getDate()).padStart(2, '0')

  // Find payments created today with an auto-generated receipt number
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

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/payments/razorpay/verify')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = verifySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, invoiceId, patientId, amount } = parsed.data

    // Get payment settings to verify signature
    const paymentSettings = await db.paymentSettings.findFirst()
    if (!paymentSettings?.razorpayKeySecret) {
      return NextResponse.json({ error: 'Razorpay not configured' }, { status: 400 })
    }

    const keySecret = decrypt(paymentSettings.razorpayKeySecret)

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex')

    if (expectedSignature !== razorpaySignature) {
      return NextResponse.json({ error: 'Payment verification failed: Invalid signature' }, { status: 400 })
    }

    // Create payment in database (transactional)
    const result = await db.$transaction(async (tx) => {
      const freshInvoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: { payments: { where: { status: 'Success' } } },
      })

      if (!freshInvoice) throw new Error('Invoice not found')
      if (freshInvoice.status === 'Cancelled') throw new Error('Invoice is cancelled')
      if (freshInvoice.status === 'Paid') throw new Error('Invoice is already paid')

      const currentPaid = freshInvoice.payments.reduce((sum, p) => sum + p.amount, 0)
      const remaining = freshInvoice.grandTotal - currentPaid

      if (amount > remaining) {
        throw new Error(`Payment amount (₹${amount.toFixed(2)}) exceeds balance (₹${remaining.toFixed(2)})`)
      }

      const lastPayment = await tx.payment.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { paymentId: true },
      })
      const paymentId = generatePaymentId(lastPayment?.paymentId ?? null)

      // Auto-generate receipt number
      const receiptNumber = await generateReceiptNumber(tx)

      const payment = await tx.payment.create({
        data: {
          paymentId,
          invoiceId,
          patientId,
          amount,
          method: 'Razorpay',
          razorpayPaymentId,
          razorpayOrderId,
          razorpaySignature,
          receiptNumber,
          status: 'Success',
        },
      })

      const newPaid = parseFloat((currentPaid + amount).toFixed(2))
      const newStatus = newPaid >= freshInvoice.grandTotal ? 'Paid' : 'Partially Paid'

      await tx.invoice.update({
        where: { id: invoiceId },
        data: { paidAmount: newPaid, status: newStatus },
      })

      return { payment, newPaid, newStatus }
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
        invoiceId,
        amount,
        method: 'Razorpay',
        razorpayPaymentId,
        receiptNumber: result.payment.receiptNumber,
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({
      data: result.payment,
      paidAmount: result.newPaid,
      invoiceStatus: result.newStatus,
    })
  } catch (error) {
    console.error('[RAZORPAY_VERIFY]', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message.includes('Invalid signature') || message.includes('verification failed')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    if (message.includes('not found') || message.includes('cancelled') || message.includes('already paid')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    if (message.includes('exceeds balance')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Payment verification failed', details: message }, { status: 500 })
  }
}