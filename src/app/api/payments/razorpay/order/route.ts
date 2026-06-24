import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest } from '@/lib/api-auth'
import { decrypt } from '@/lib/crypto'

const createOrderSchema = z.object({
  invoiceId: z.string().trim().min(1, 'Invoice ID is required'),
  amount: z.number().positive('Amount must be greater than 0'),
})

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/payments/razorpay/order')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const body = await request.json()
    const parsed = createOrderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { invoiceId, amount } = parsed.data

    // Check payment settings
    const paymentSettings = await db.paymentSettings.findFirst()
    if (!paymentSettings?.razorpayEnabled) {
      return NextResponse.json({ error: 'Razorpay is not enabled. Please configure it in Settings > Payment.' }, { status: 400 })
    }
    if (!paymentSettings.razorpayKeyId || !paymentSettings.razorpayKeySecret) {
      return NextResponse.json({ error: 'Razorpay API keys are not configured. Please add them in Settings > Payment.' }, { status: 400 })
    }

    // Verify invoice exists and is payable
    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        patient: { select: { id: true, name: true, email: true, phone: true } },
        payments: { where: { status: 'Success' } },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }
    if (invoice.status === 'Cancelled') {
      return NextResponse.json({ error: 'Cannot pay a cancelled invoice' }, { status: 400 })
    }
    if (invoice.status === 'Paid') {
      return NextResponse.json({ error: 'Invoice is already fully paid' }, { status: 400 })
    }

    const paidSoFar = invoice.payments.reduce((sum, p) => sum + p.amount, 0)
    const balance = invoice.grandTotal - paidSoFar
    if (amount > balance) {
      return NextResponse.json(
        { error: `Amount exceeds remaining balance. Max: ₹${balance.toFixed(2)}` },
        { status: 400 }
      )
    }

    // Decrypt API keys
    const keyId = paymentSettings.razorpayKeyId
    const keySecret = decrypt(paymentSettings.razorpayKeySecret)
    const isTest = paymentSettings.razorpayMode === 'Test'
    const baseURL = isTest ? 'https://api.razorpay.com/v1' : 'https://api.razorpay.com/v1'

    // Create Razorpay order
    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
    const orderResponse = await fetch(`${baseURL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`,
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // Razorpay expects amount in paise
        currency: 'INR',
        receipt: invoice.invoiceNumber,
        notes: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          patientName: invoice.patient?.name || 'Unknown',
        },
      }),
    })

    if (!orderResponse.ok) {
      const errorData = await orderResponse.json().catch(() => ({}))
      console.error('[RAZORPAY_ORDER_ERROR]', errorData)
      return NextResponse.json(
        { error: 'Failed to create Razorpay order', details: errorData.error?.description || 'Unknown error' },
        { status: 502 }
      )
    }

    const orderData = await orderResponse.json()

    return NextResponse.json({
      data: {
        orderId: orderData.id,
        amount: orderData.amount,
        currency: orderData.currency,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        patientName: invoice.patient?.name,
        keyId: keyId,
        mode: paymentSettings.razorpayMode,
      },
    })
  } catch (error) {
    console.error('[RAZORPAY_ORDER]', error)
    return NextResponse.json(
      { error: 'Failed to create Razorpay order', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
