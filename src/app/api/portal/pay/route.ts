import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { generatePaymentId } from '@/lib/utils'
import { z } from 'zod'

const paySchema = z.object({
  invoiceId: z.string().trim().min(1, 'Invoice ID is required'),
  amount: z.number().positive('Amount must be positive'),
  paymentMethod: z.string().trim().min(1, 'Payment method is required'),
})

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const token = authHeader.replace('Bearer ', '')
  const decoded = verifyToken(token)
  if (!decoded) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }

  const portalUser = await db.portalUser.findUnique({
    where: { id: decoded.id },
    select: { patientId: true, status: true },
  })
  if (!portalUser || portalUser.status !== 'Active') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const parsed = paySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { invoiceId, amount, paymentMethod } = parsed.data

    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (invoice.patientId !== portalUser.patientId) {
      return NextResponse.json({ error: 'Invoice does not belong to this patient' }, { status: 403 })
    }

    if (invoice.status === 'Paid' || invoice.status === 'Cancelled') {
      return NextResponse.json({ error: `Invoice is already ${invoice.status.toLowerCase()}` }, { status: 400 })
    }

    const newPaidAmount = invoice.paidAmount + amount
    const remaining = invoice.grandTotal - newPaidAmount
    const newStatus = remaining <= 0 ? 'Paid' : 'Partially Paid'

    const lastPayment = await db.payment.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { paymentId: true },
    })
    const paymentId = generatePaymentId(lastPayment?.paymentId ?? null)

    const [payment] = await db.$transaction([
      db.payment.create({
        data: {
          paymentId,
          invoiceId: invoice.id,
          patientId: portalUser.patientId,
          amount,
          method: paymentMethod,
          status: 'Success',
        },
      }),
      db.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
        },
      }),
    ])

    return NextResponse.json({
      data: {
        payment: {
          paymentId: payment.paymentId,
          amount: payment.amount,
          method: payment.method,
          status: payment.status,
          createdAt: payment.createdAt,
        },
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          paidAmount: newPaidAmount,
          status: newStatus,
          remaining,
        },
      },
    }, { status: 201 })
  } catch (error) {
    console.error('[PORTAL_PAY_POST]', error)
    return NextResponse.json(
      { error: 'Payment failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
