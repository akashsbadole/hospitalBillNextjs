import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generatePaymentId } from '@/lib/utils'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'
import { decrypt } from '@/lib/crypto'

const captureSchema = z.object({
  paypalOrderId: z.string().trim().min(1, 'PayPal Order ID is required'),
  invoiceId: z.string().trim().min(1, 'Invoice ID is required'),
  patientId: z.string().trim().min(1, 'Patient ID is required'),
  amount: z.number().positive('Amount must be greater than 0'),
})

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/payments/paypal/capture')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = captureSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { paypalOrderId, invoiceId, patientId, amount } = parsed.data

    // Get payment settings
    const paymentSettings = await db.paymentSettings.findFirst()
    if (!paymentSettings?.paypalClientId || !paymentSettings?.paypalClientSecret) {
      return NextResponse.json({ error: 'PayPal not configured' }, { status: 400 })
    }

    const clientId = paymentSettings.paypalClientId
    const clientSecret = decrypt(paymentSettings.paypalClientSecret)
    const isSandbox = paymentSettings.paypalMode === 'Sandbox'
    const base = isSandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com'

    // Get access token
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    const tokenResponse = await fetch(`${base}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: 'grant_type=client_credentials',
    })

    if (!tokenResponse.ok) {
      return NextResponse.json({ error: 'PayPal authentication failed' }, { status: 502 })
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // Capture the order
    const captureResponse = await fetch(`${base}/v2/checkout/orders/${paypalOrderId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!captureResponse.ok) {
      const errorData = await captureResponse.json().catch(() => ({}))
      console.error('[PAYPAL_CAPTURE_ERROR]', errorData)
      return NextResponse.json(
        { error: 'Failed to capture PayPal payment', details: errorData.message || 'Unknown error' },
        { status: 502 }
      )
    }

    const captureData = await captureResponse.json()

    if (captureData.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: `PayPal payment not completed. Status: ${captureData.status}` },
        { status: 400 }
      )
    }

    // Get capture ID from response
    const captureId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id || paypalOrderId

    // Create payment in database
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

      const payment = await tx.payment.create({
        data: {
          paymentId,
          invoiceId,
          patientId,
          amount,
          method: 'PayPal',
          paypalOrderId,
          paypalCaptureId: captureId,
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
        method: 'PayPal',
        paypalOrderId,
        paypalCaptureId: captureId,
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({
      data: result.payment,
      paidAmount: result.newPaid,
      invoiceStatus: result.newStatus,
    })
  } catch (error) {
    console.error('[PAYPAL_CAPTURE]', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message.includes('not found') || message.includes('cancelled') || message.includes('already paid')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    if (message.includes('exceeds balance')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to capture PayPal payment', details: message }, { status: 500 })
  }
}
