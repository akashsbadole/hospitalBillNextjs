import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'

const VALID_TYPES = ['Purchase', 'Sale', 'Return', 'Adjustment', 'Expiry']

// ── GET: List Stock Movements ──────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/inventory/stock-movements')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const medicineId = searchParams.get('medicineId')
    const type = searchParams.get('type')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    if (type && !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type filter', details: `Must be one of: ${VALID_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    const where: Record<string, unknown> = {}
    if (medicineId) where.medicineId = medicineId
    if (type) where.type = type
    if (fromDate || toDate) {
      const dateFilter: Record<string, unknown> = {}
      if (fromDate) dateFilter.gte = new Date(fromDate)
      if (toDate) dateFilter.lte = new Date(toDate + 'T23:59:59.999Z')
      where.createdAt = dateFilter
    }

    const [movements, total] = await Promise.all([
      db.stockMovement.findMany({
        where,
        include: {
          medicine: { select: { id: true, medicineId: true, name: true, category: true, manufacturer: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.stockMovement.count({ where }),
    ])

    return NextResponse.json({
      data: movements,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[STOCK_MOVEMENTS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch stock movements', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}