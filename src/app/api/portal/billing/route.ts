import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
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
    const invoices = await db.invoice.findMany({
      where: { patientId: portalUser.patientId },
      orderBy: { date: 'desc' },
      include: {
        items: true,
        payments: {
          select: { paymentId: true, amount: true, method: true, status: true, createdAt: true },
        },
      },
    })

    return NextResponse.json({ data: invoices })
  } catch (error) {
    console.error('[PORTAL_BILLING_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoices', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
