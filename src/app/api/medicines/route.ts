import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generateMedicineId } from '@/lib/utils'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── Schemas ──────────────────────────────────────────────────────────────
const createMedicineSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(300),
  category: z.string().trim().optional(),
  manufacturer: z.string().trim().optional(),
  batchNumber: z.string().trim().optional(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry date must be YYYY-MM-DD').optional(),
  purchasePrice: z.number().min(0, 'Purchase price cannot be negative').default(0),
  sellingPrice: z.number().min(0, 'Selling price cannot be negative').default(0),
  stock: z.number().int().min(0, 'Stock cannot be negative').default(0),
  minStock: z.number().int().min(0, 'Minimum stock cannot be negative').default(10),
  gstRate: z.number().min(0).max(28).default(12),
  hsnCode: z.string().trim().optional(),
  status: z.enum(['Active', 'Inactive']).default('Active'),
})

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/medicines')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const search = searchParams.get('search')?.trim() || ''
    const category = searchParams.get('category')?.trim() || ''
    const stockStatus = searchParams.get('stockStatus')?.trim() || ''
    const status = searchParams.get('status')

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    const validStatuses = ['Active', 'Inactive']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status filter', details: `Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    if (stockStatus && !['In Stock', 'Low Stock', 'Out of Stock'].includes(stockStatus)) {
      return NextResponse.json(
        { error: 'Invalid stockStatus filter', details: 'Must be one of: In Stock, Low Stock, Out of Stock' },
        { status: 400 }
      )
    }

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (category) where.category = category
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { manufacturer: { contains: search, mode: 'insensitive' } },
        { medicineId: { contains: search, mode: 'insensitive' } },
        { batchNumber: { contains: search } },
      ]
    }

    // Fetch all matching records, then filter by dynamic stockStatus in memory
    // because stockStatus depends on each medicine's own minStock field
    const [allMedicines] = await Promise.all([
      db.medicine.findMany({
        where,
        orderBy: { name: 'asc' },
      }),
      db.medicine.count({ where }),
    ])

    // Filter by stockStatus using each medicine's own minStock (NOT hardcoded 10)
    let filtered = allMedicines
    if (stockStatus) {
      if (stockStatus === 'In Stock') {
        filtered = allMedicines.filter((m) => m.stock > m.minStock)
      } else if (stockStatus === 'Low Stock') {
        filtered = allMedicines.filter((m) => m.stock > 0 && m.stock <= m.minStock)
      } else if (stockStatus === 'Out of Stock') {
        filtered = allMedicines.filter((m) => m.stock <= 0)
      }
    }

    // Apply pagination after in-memory filtering
    const paginatedMedicines = filtered.slice(skip, skip + limit)
    const filteredTotal = filtered.length

    return NextResponse.json({
      data: paginatedMedicines,
      total: filteredTotal,
      page,
      limit,
      totalPages: Math.ceil(filteredTotal / limit),
    })
  } catch (error) {
    console.error('[MEDICINES_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch medicines', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── POST ─────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/medicines')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()

    const parsed = createMedicineSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Auto-generate medicineId
    const lastMedicine = await db.medicine.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { medicineId: true },
    })
    const medicineId = generateMedicineId(lastMedicine?.medicineId ?? null)

    const medicine = await db.medicine.create({
      data: {
        ...data,
        medicineId,
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'medicines',
      details: { medicineId: medicine.medicineId, name: medicine.name },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: medicine }, { status: 201 })
  } catch (error) {
    console.error('[MEDICINES_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create medicine', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
