import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generatePurchaseOrderId } from '@/lib/utils'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const VALID_STATUSES = ['Draft', 'Submitted', 'Approved', 'Partially Received', 'Received', 'Cancelled']

const createItemSchema = z.object({
  medicineId: z.string().min(1, 'Medicine ID is required'),
  quantity: z.number().int().positive('Quantity must be positive'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
})

const createPOSchema = z.object({
  supplierId: z.string().min(1, 'Supplier ID is required'),
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Order date must be YYYY-MM-DD'),
  expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected date must be YYYY-MM-DD').optional(),
  notes: z.string().optional(),
  items: z.array(createItemSchema).min(1, 'At least one item is required'),
})

// ── GET: List Purchase Orders ──────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/inventory/purchase-orders')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const status = searchParams.get('status')
    const supplierId = searchParams.get('supplierId')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status filter', details: `Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (supplierId) where.supplierId = supplierId
    if (fromDate || toDate) {
      const dateFilter: Record<string, unknown> = {}
      if (fromDate) dateFilter.gte = fromDate
      if (toDate) dateFilter.lte = toDate
      where.orderDate = dateFilter
    }

    const [purchaseOrders, total] = await Promise.all([
      db.purchaseOrder.findMany({
        where,
        include: {
          supplier: { select: { id: true, supplierId: true, name: true, contact: true, email: true } },
          items: { include: { medicine: { select: { id: true, medicineId: true, name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.purchaseOrder.count({ where }),
    ])

    return NextResponse.json({
      data: purchaseOrders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[PURCHASE_ORDERS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchase orders', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── POST: Create Purchase Order ────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/inventory/purchase-orders')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createPOSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { supplierId, orderDate, expectedDate, notes, items } = parsed.data

    // Validate supplier exists
    const supplier = await db.supplier.findUnique({ where: { id: supplierId } })
    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    // Validate all medicines exist
    const medicineIds = items.map((item) => item.medicineId)
    const medicines = await db.medicine.findMany({
      where: { id: { in: medicineIds } },
      select: { id: true, name: true },
    })
    if (medicines.length !== medicineIds.length) {
      return NextResponse.json({ error: 'One or more medicines not found' }, { status: 400 })
    }

    // Calculate totals
    const poItems = items.map((item) => ({
      medicineId: item.medicineId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      receivedQty: 0,
      total: item.quantity * item.unitPrice,
    }))
    const totalAmount = poItems.reduce((sum, item) => sum + item.total, 0)

    // Generate PO ID
    const lastPO = await db.purchaseOrder.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { poId: true },
    })
    const poId = generatePurchaseOrderId(lastPO?.poId ?? null)

    const purchaseOrder = await db.purchaseOrder.create({
      data: {
        poId,
        supplierId,
        status: 'Draft',
        orderDate,
        expectedDate: expectedDate || null,
        notes: notes || null,
        totalAmount,
        receivedAmount: 0,
        items: { create: poItems },
      },
      include: {
        supplier: { select: { id: true, supplierId: true, name: true, contact: true, email: true } },
        items: { include: { medicine: { select: { id: true, medicineId: true, name: true } } } },
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'medicines',
      details: { poId: purchaseOrder.poId, supplierId: supplier.name, totalAmount, itemCount: items.length },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: purchaseOrder }, { status: 201 })
  } catch (error) {
    console.error('[PURCHASE_ORDERS_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create purchase order', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}