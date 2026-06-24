import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest } from '@/lib/api-auth'
import { decrypt } from '@/lib/crypto'

async function getPayPalAccessToken(clientId: string, clientSecret: string, isSandbox: boolean): Promise<string> {
  const base = isSandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com'
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials',
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(`PayPal auth failed: ${errorData.error_description || 'Unknown error'}`)
  }

  const data = await response.json()
  return data.access_token
}

const createOrderSchema = z.object({
  invoiceId: z.string().trim().min(1, 'Invoice ID is required'),
  amount: z.number().positive('Amount must be greater than 0'),
  currency: z.string().optional().default('USD'),
})

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/payments/paypal/order')
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

    const { invoiceId, amount, currency } = parsed.data

    // Check payment settings
    const paymentSettings = await db.paymentSettings.findFirst()
    if (!paymentSettings?.paypalEnabled) {
      return NextResponse.json({ error: 'PayPal is not enabled. Please configure it in Settings > Payment.' }, { status: 400 })
    }
    if (!paymentSettings.paypalClientId || !paymentSettings.paypalClientSecret) {
      return NextResponse.json({ error: 'PayPal credentials are not configured. Please add them in Settings > Payment.' }, { status: 400 })
    }

    // Verify invoice
    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        patient: { select: { id: true, name: true, email: true } },
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

    // Decrypt credentials
    const clientId = paymentSettings.paypalClientId
    const clientSecret = decrypt(paymentSettings.paypalClientSecret)
    const isSandbox = paymentSettings.paypalMode === 'Sandbox'
    const payCurrency = paymentSettings.paypalCurrency || currency

    // Get access token
    const accessToken = await getPayPalAccessToken(clientId, clientSecret, isSandbox)
    const base = isSandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com'

    // Create PayPal order
    const orderResponse = await fetch(`${base}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'PayPal-Request-Id': `medibill-${invoiceId}-${Date.now()}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: invoice.invoiceNumber,
            description: `Invoice ${invoice.invoiceNumber} - ${invoice.patient?.name || 'Patient'}`,
            custom_id: invoice.id,
            amount: {
              currency_code: payCurrency,
              value: amount.toFixed(2),
              breakdown: {
                item_total: {
                  currency_code: payCurrency,
                  value: amount.toFixed(2),
                },
              },
            },
          },
        ],
        application_context: {
          brand_name: 'MediBill Pro',
          user_action: 'PAY_NOW',
          shipping_preference: 'NO_SHIPPING',
        },
      }),
    })

    if (!orderResponse.ok) {
      const errorData = await orderResponse.json().catch(() => ({}))
      console.error('[PAYPAL_ORDER_ERROR]', errorData)
      return NextResponse.json(
        { error: 'Failed to create PayPal order', details: errorData.message || 'Unknown error' },
        { status: 502 }
      )
    }

    const orderData = await orderResponse.json()

    // Find the approve link
    const approveLink = orderData.links?.find((link: { rel: string }) => link.rel === 'approve')

    return NextResponse.json({
      data: {
        orderId: orderData.id,
        status: orderData.status,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        patientName: invoice.patient?.name,
        currency: payCurrency,
        amount: amount.toFixed(2),
        approveUrl: approveLink?.href || '',
        mode: paymentSettings.paypalMode,
      },
    })
  } catch (error) {
    console.error('[PAYPAL_ORDER]', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message.includes('PayPal auth failed')) {
      return NextResponse.json({ error: 'PayPal authentication failed. Please check your credentials.', details: message }, { status: 502 })
    }
    return NextResponse.json({ error: 'Failed to create PayPal order', details: message }, { status: 500 })
  }
}
