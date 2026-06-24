import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const createDispatchSchema = z.object({
  ambulanceId: z.string().min(1, 'Ambulance is required'),
  patientId: z.string().optional(),
  pickupAddress: z.string().trim().max(500).optional(),
  destination: z.string().trim().max(500).optional(),
  dispatchType: z.enum(['Emergency', 'Transfer', 'Discharge', 'Event']).default('Emergency'),
  distanceKm: z.number().min(0).optional(),
  fare: z.number().min(0).default(0),
  paymentStatus: z.enum(['Pending', 'Paid', 'Waived']).default('Pending'),
  notes: z.string().trim().max(1000).optional(),
  branchId: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/ambulance')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { searchParams } = request.nextUrl
    const ambulanceId = searchParams.get('ambulanceId')?.trim() || ''
    const status = searchParams.get('status')?.trim() || ''
    const dispatchType = searchParams.get('dispatchType')?.trim() || ''

    const where: Record<string, unknown> = {}
    if (ambulanceId) where.ambulanceId = ambulanceId
    if (status) where.status = status
    if (dispatchType) where.dispatchType = dispatchType

    const dispatches = await db.ambulanceDispatch.findMany({
      where,
      include: {
        ambulance: {
          select: { id: true, ambulanceId: true, vehicleNumber: true, driverName: true, driverPhone: true, type: true, status: true },
        },
        patient: {
          select: { id: true, patientId: true, name: true, phone: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: dispatches })
  } catch (error) {
    console.error('[DISPATCH_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch dispatches', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/ambulance')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createDispatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const ambulance = await db.ambulance.findUnique({ where: { id: parsed.data.ambulanceId } })
    if (!ambulance) {
      return NextResponse.json({ error: 'Ambulance not found' }, { status: 404 })
    }

    if (ambulance.status !== 'Available') {
      return NextResponse.json(
        { error: 'Ambulance is not available', details: `Current status: ${ambulance.status}` },
        { status: 400 }
      )
    }

    if (parsed.data.patientId) {
      const patient = await db.patient.findUnique({ where: { id: parsed.data.patientId } })
      if (!patient) {
        return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
      }
    }

    const last = await db.ambulanceDispatch.findFirst({ orderBy: { createdAt: 'desc' }, select: { dispatchId: true } })
    const num = last ? parseInt(last.dispatchId.replace('DIS-', ''), 10) + 1 : 1
    const dispatchId = `DIS-${String(num).padStart(4, '0')}`

    const dispatch = await db.ambulanceDispatch.create({
      data: {
        ...parsed.data,
        dispatchId,
        status: 'Dispatched',
        dispatchedAt: new Date(),
      },
    })

    await db.ambulance.update({
      where: { id: parsed.data.ambulanceId },
      data: { status: 'On-Duty' },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'ambulance',
      details: { dispatchId: dispatch.dispatchId, ambulanceId: parsed.data.ambulanceId, dispatchType: parsed.data.dispatchType },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: dispatch }, { status: 201 })
  } catch (error) {
    console.error('[DISPATCH_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create dispatch', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
