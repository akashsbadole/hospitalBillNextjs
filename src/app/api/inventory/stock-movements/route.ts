import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { z } from 'zod'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const VALID_TYPES = ['Purchase', 'Sale', 'Return', 'Adjustment', 'Expiry'] as const

const createMovementSchema = z.object({
  medicineId: z.string().min(1, 'Medicine ID is required'),
  type: z.enum(VALID_TYPES),
  quantity: z.number().int().refine(n => n !== 0, 'Quantity cannot be zero'),
  referenceId: z.string().optional(),
  notes: z.string().optional(),
})

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

    if (type && !VALID_TYPES.includes(type as any)) {
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

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/inventory/stock-movements')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createMovementSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const { medicineId, type, quantity, referenceId, notes } = parsed.data

    // Check if medicine exists
    const medicine = await db.medicine.findUnique({ where: { id: medicineId } })
    if (!medicine) {
      return NextResponse.json({ error: 'Medicine not found' }, { status: 404 })
    }

    // Verify stock availability for negative movements
    if (quantity < 0 && medicine.stock + quantity < 0) {
      return NextResponse.json({ error: 'Insufficient stock available' }, { status: 400 })
    }

    const lastMovement = await db.stockMovement.findFirst({ orderBy: { createdAt: 'desc' } })
    const lastId = lastMovement?.movementId ? parseInt(lastMovement.movementId.split('-')[1], 10) : 0
    const movementId = `MOV-${String(lastId + 1).padStart(4, '0')}`

    const result = await db.$transaction(async (tx) => {
      const movement = await tx.stockMovement.create({
        data: {
          movementId,
          medicineId,
          type,
          quantity,
          referenceId,
          notes,
        },
      })

      const updatedMedicine = await tx.medicine.update({
        where: { id: medicineId },
        data: {
          stock: { increment: quantity },
        },
      })

      return { movement, updatedMedicine }
    })

    logAudit({
      userId: auth.userId!,
      userName: auth.user!.name,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'inventory',
      details: {
        movementId: result.movement.id,
        medicineName: result.updatedMedicine.name,
        type,
        quantity,
        newStock: result.updatedMedicine.stock,
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: result.movement }, { status: 201 })
  } catch (error) {
    console.error('[STOCK_MOVEMENTS_POST]', error)
    return NextResponse.json({ error: 'Failed to record stock movement' }, { status: 500 })
  }
}
