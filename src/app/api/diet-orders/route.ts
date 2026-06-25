import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generateDietOrderId } from '@/lib/utils'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const createDietOrderSchema = z.object({
  patientId: z.string().trim().min(1, 'Patient ID is required'),
  visitId: z.string().trim().optional(),
  dietType: z.string().trim().min(1, 'Diet type is required'),
  mealPlan: z.string().trim().optional(),
  preferences: z.string().optional(),
  allergies: z.string().optional(),
  instructions: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD').optional(),
  createdBy: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/diet-orders')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { searchParams } = request.nextUrl
    const patientId = searchParams.get('patientId')
    const visitId = searchParams.get('visitId')
    const status = searchParams.get('status')
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (patientId) where.patientId = patientId
    if (visitId) where.visitId = visitId
    if (status) where.status = status

    const [orders, total] = await Promise.all([
      db.dietOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: { select: { id: true, patientId: true, name: true, phone: true } },
          visit: { select: { id: true, visitId: true, visitType: true, department: true } },
        },
      }),
      db.dietOrder.count({ where }),
    ])

    return NextResponse.json({ data: orders, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('[DIET_ORDERS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch diet orders', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/diet-orders')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createDietOrderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const patient = await db.patient.findUnique({ where: { id: data.patientId } })
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    if (data.visitId) {
      const visit = await db.patientVisit.findUnique({ where: { id: data.visitId } })
      if (!visit) {
        return NextResponse.json({ error: 'Visit not found' }, { status: 404 })
      }
    }

    const lastOrder = await db.dietOrder.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { orderId: true },
    })
    const orderId = generateDietOrderId(lastOrder?.orderId ?? null)

    const order = await db.dietOrder.create({
      data: {
        orderId,
        patientId: data.patientId,
        visitId: data.visitId ?? null,
        dietType: data.dietType,
        mealPlan: data.mealPlan ?? null,
        preferences: data.preferences ?? null,
        allergies: data.allergies ?? null,
        instructions: data.instructions ?? null,
        startDate: data.startDate ?? null,
        endDate: data.endDate ?? null,
        createdBy: data.createdBy ?? auth.userId,
      },
      include: {
        patient: { select: { id: true, patientId: true, name: true } },
        visit: { select: { id: true, visitId: true } },
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'patients',
      details: { orderId: order.orderId, patientId: data.patientId, dietType: data.dietType },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: order }, { status: 201 })
  } catch (error) {
    console.error('[DIET_ORDERS_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create diet order', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
