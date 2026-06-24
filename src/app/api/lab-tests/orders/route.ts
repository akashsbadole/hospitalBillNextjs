import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'
import { createLabTestOrderSchema } from '@/lib/validations'
import { generateLabTestOrderId } from '@/lib/utils'

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/lab-tests')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const search = searchParams.get('search')?.trim() || ''
    const visitId = searchParams.get('visitId')
    const patientId = searchParams.get('patientId')
    const status = searchParams.get('status')
    const testId = searchParams.get('testId')

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    const validStatuses = ['Ordered', 'Sample Collected', 'Processing', 'Completed', 'Reported']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status filter', details: `Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (visitId) where.visitId = visitId
    if (patientId) where.patientId = patientId
    if (testId) where.testId = testId
    if (search) {
      where.OR = [
        { orderId: { contains: search } },
        { patient: { name: { contains: search } } },
        { test: { name: { contains: search } } },
      ]
    }

    const [orders, total] = await Promise.all([
      db.labTestOrder.findMany({
        where,
        orderBy: { orderedAt: 'desc' },
        skip,
        take: limit,
        include: {
          patient: { select: { id: true, patientId: true, name: true, phone: true } },
          test: { select: { id: true, testId: true, name: true, category: true, normalRange: true, unit: true } },
          doctor: { select: { id: true, doctorId: true, name: true, specialization: true } },
          visit: { select: { id: true, visitId: true, visitType: true, department: true } },
        },
      }),
      db.labTestOrder.count({ where }),
    ])

    return NextResponse.json({
      data: orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[LAB_TEST_ORDERS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch lab test orders', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── POST ─────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/lab-tests')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()

    const parsed = createLabTestOrderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Validate visit exists
    const visit = await db.patientVisit.findUnique({ where: { id: data.visitId } })
    if (!visit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 })
    }

    // Validate patient exists
    const patient = await db.patient.findUnique({ where: { id: data.patientId } })
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Validate test exists and is active
    const test = await db.labTestCatalog.findUnique({ where: { id: data.testId } })
    if (!test) {
      return NextResponse.json({ error: 'Lab test not found' }, { status: 404 })
    }
    if (test.status !== 'Active') {
      return NextResponse.json({ error: 'Lab test is not active' }, { status: 400 })
    }

    // Validate doctor if provided
    if (data.doctorId) {
      const doctor = await db.doctor.findUnique({ where: { id: data.doctorId } })
      if (!doctor) {
        return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
      }
    }

    // Auto-generate orderId
    const lastOrder = await db.labTestOrder.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { orderId: true },
    })
    const orderId = generateLabTestOrderId(lastOrder?.orderId ?? null)

    const order = await db.labTestOrder.create({
      data: {
        ...data,
        orderId,
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'lab-tests',
      details: { orderId: order.orderId, visitId: data.visitId, patientId: data.patientId, testId: data.testId, test: test.name },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: order }, { status: 201 })
  } catch (error) {
    console.error('[LAB_TEST_ORDERS_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create lab test order', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}