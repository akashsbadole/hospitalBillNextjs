import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generatePharmacySaleId } from '@/lib/utils'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const saleItemSchema = z.object({
  medicineId: z.string().optional(),
  medicineName: z.string().trim().min(1, 'Medicine name is required'),
  batchNumber: z.string().optional(),
  quantity: z.number().int().positive('Quantity must be positive'),
  unitPrice: z.number().nonnegative('Unit price must be non-negative'),
})

const createPharmacySaleSchema = z.object({
  patientId: z.string().optional(),
  patientName: z.string().optional(),
  patientPhone: z.string().optional(),
  items: z.array(saleItemSchema).min(1, 'At least one item is required'),
  discount: z.number().nonnegative().default(0),
  paymentMethod: z.string().default('Cash'),
  notes: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/pharmacy-sales')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    const status = searchParams.get('status')

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    if (fromDate && !/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
      return NextResponse.json({ error: 'Invalid fromDate format', details: 'Must be YYYY-MM-DD' }, { status: 400 })
    }
    if (toDate && !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      return NextResponse.json({ error: 'Invalid toDate format', details: 'Must be YYYY-MM-DD' }, { status: 400 })
    }

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (fromDate || toDate) {
      const dateFilter: Record<string, Date> = {}
      if (fromDate) dateFilter.gte = new Date(fromDate + 'T00:00:00Z')
      if (toDate) dateFilter.lte = new Date(toDate + 'T23:59:59Z')
      where.createdAt = dateFilter
    }

    const [sales, total] = await Promise.all([
      db.pharmacySale.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: { select: { id: true, patientId: true, name: true, phone: true } },
          items: {
            include: { medicine: { select: { id: true, medicineId: true, name: true } } },
          },
        },
      }),
      db.pharmacySale.count({ where }),
    ])

    return NextResponse.json({ data: sales, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('[PHARMACY_SALES_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch pharmacy sales', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/pharmacy-sales')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createPharmacySaleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    if (data.patientId) {
      const patient = await db.patient.findUnique({ where: { id: data.patientId } })
      if (!patient) {
        return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
      }
    }

    // Validate medicine stock
    for (const item of data.items) {
      if (item.medicineId) {
        const medicine = await db.medicine.findUnique({ where: { id: item.medicineId } })
        if (!medicine) {
          return NextResponse.json(
            { error: `Medicine not found`, details: `ID: ${item.medicineId}` },
            { status: 404 }
          )
        }
        if (medicine.stock < item.quantity) {
          return NextResponse.json(
            { error: `Insufficient stock`, details: `${medicine.name} has only ${medicine.stock} units available` },
            { status: 400 }
          )
        }
      }
    }

    // Calculate totals
    const itemsWithTotal = data.items.map((item) => ({
      ...item,
      total: item.quantity * item.unitPrice,
    }))
    const totalAmount = itemsWithTotal.reduce((sum, item) => sum + item.total, 0)
    const grandTotal = totalAmount - data.discount

    // Auto-generate sale ID
    const lastSale = await db.pharmacySale.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { saleId: true },
    })
    const saleId = generatePharmacySaleId(lastSale?.saleId ?? null)

    const sale = await db.pharmacySale.create({
      data: {
        saleId,
        patientId: data.patientId ?? null,
        patientName: data.patientName ?? null,
        patientPhone: data.patientPhone ?? null,
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        discount: data.discount,
        grandTotal: parseFloat(grandTotal.toFixed(2)),
        paymentMethod: data.paymentMethod,
        status: 'Completed',
        notes: data.notes ?? null,
        createdBy: auth.userId,
        items: {
          create: itemsWithTotal.map((item) => ({
            medicineId: item.medicineId ?? null,
            medicineName: item.medicineName,
            batchNumber: item.batchNumber ?? null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: parseFloat(item.total.toFixed(2)),
          })),
        },
      },
      include: {
        patient: { select: { id: true, patientId: true, name: true } },
        items: true,
      },
    })

    // Reduce stock for each medicine
    for (const item of data.items) {
      if (item.medicineId) {
        await db.medicine.update({
          where: { id: item.medicineId },
          data: { stock: { decrement: item.quantity } },
        })
        await db.stockMovement.create({
          data: {
            movementId: `SM-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            medicineId: item.medicineId,
            type: 'Sale',
            quantity: -item.quantity,
            referenceId: saleId,
            notes: `Pharmacy sale ${saleId}`,
          },
        })
      }
    }

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'patients',
      details: { saleId: sale.saleId, grandTotal: sale.grandTotal, itemsCount: data.items.length },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: sale }, { status: 201 })
  } catch (error) {
    console.error('[PHARMACY_SALES_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create pharmacy sale', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
