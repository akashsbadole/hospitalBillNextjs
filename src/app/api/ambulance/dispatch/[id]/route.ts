import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const DISPATCH_STAGES = ['Dispatched', 'Arrived', 'Patient-Aboard', 'At-Destination', 'Completed', 'Cancelled'] as const

const updateDispatchSchema = z.object({
  status: z.enum(DISPATCH_STAGES).optional(),
  pickupAddress: z.string().trim().max(500).optional(),
  destination: z.string().trim().max(500).optional(),
  dispatchType: z.enum(['Emergency', 'Transfer', 'Discharge', 'Event']).optional(),
  distanceKm: z.number().min(0).optional(),
  fare: z.number().min(0).optional(),
  paymentStatus: z.enum(['Pending', 'Paid', 'Waived']).optional(),
  notes: z.string().trim().max(1000).optional(),
})

const STATUS_TIME_FIELDS: Record<string, string> = {
  Arrived: 'arrivedAt',
  'Patient-Aboard': 'patientAboardAt',
  'At-Destination': 'destinationAt',
  Completed: 'completedAt',
}

const STATUS_SEQUENCE = ['Dispatched', 'Arrived', 'Patient-Aboard', 'At-Destination', 'Completed']

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/ambulance')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Dispatch ID is required' }, { status: 400 })
    }

    const dispatch = await db.ambulanceDispatch.findUnique({
      where: { id },
      include: {
        ambulance: {
          select: { id: true, ambulanceId: true, vehicleNumber: true, driverName: true, driverPhone: true, type: true },
        },
        patient: {
          select: { id: true, patientId: true, name: true, phone: true },
        },
      },
    })

    if (!dispatch) {
      return NextResponse.json({ error: 'Dispatch not found' }, { status: 404 })
    }

    return NextResponse.json({ data: dispatch })
  } catch (error) {
    console.error('[DISPATCH_ID_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch dispatch', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/ambulance')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Dispatch ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateDispatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await db.ambulanceDispatch.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Dispatch not found' }, { status: 404 })
    }

    if (existing.status === 'Completed' || existing.status === 'Cancelled') {
      return NextResponse.json(
        { error: 'Cannot update a completed or cancelled dispatch' },
        { status: 400 }
      )
    }

    const data: Record<string, unknown> = {}

    if (parsed.data.status) {
      const currentIdx = STATUS_SEQUENCE.indexOf(existing.status)
      const newIdx = STATUS_SEQUENCE.indexOf(parsed.data.status)

      if (parsed.data.status !== 'Cancelled' && newIdx >= 0 && currentIdx >= 0 && newIdx !== currentIdx + 1 && newIdx !== currentIdx) {
        if (newIdx <= currentIdx && newIdx !== currentIdx) {
          return NextResponse.json(
            { error: 'Invalid status transition', details: `Cannot go back from "${existing.status}" to "${parsed.data.status}".` },
            { status: 400 }
          )
        }
        if (newIdx > currentIdx + 1) {
          return NextResponse.json(
            { error: 'Invalid status transition', details: `Must go through intermediate stages. Expected "${STATUS_SEQUENCE[currentIdx + 1]}" or "${existing.status}".` },
            { status: 400 }
          )
        }
      }

      data.status = parsed.data.status
      data.updatedAt = new Date()

      const timeField = STATUS_TIME_FIELDS[parsed.data.status]
      if (timeField) {
        data[timeField] = new Date()
      }

      if (parsed.data.status === 'Arrived' && !existing.arrivedAt) {
        data.arrivedAt = new Date()
      }
      if (parsed.data.status === 'Patient-Aboard' && !existing.patientAboardAt) {
        data.patientAboardAt = new Date()
      }
      if (parsed.data.status === 'At-Destination' && !existing.destinationAt) {
        data.destinationAt = new Date()
      }
      if (parsed.data.status === 'Completed') {
        data.completedAt = new Date()
        await db.ambulance.update({
          where: { id: existing.ambulanceId },
          data: { status: 'Available' },
        })
      }
      if (parsed.data.status === 'Cancelled') {
        await db.ambulance.update({
          where: { id: existing.ambulanceId },
          data: { status: 'Available' },
        })
      }
    }

    if (parsed.data.pickupAddress !== undefined) data.pickupAddress = parsed.data.pickupAddress
    if (parsed.data.destination !== undefined) data.destination = parsed.data.destination
    if (parsed.data.dispatchType !== undefined) data.dispatchType = parsed.data.dispatchType
    if (parsed.data.distanceKm !== undefined) data.distanceKm = parsed.data.distanceKm
    if (parsed.data.fare !== undefined) data.fare = parsed.data.fare
    if (parsed.data.paymentStatus !== undefined) data.paymentStatus = parsed.data.paymentStatus
    if (parsed.data.notes !== undefined) data.notes = parsed.data.notes

    const updated = await db.ambulanceDispatch.update({ where: { id }, data })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'UPDATE',
      module: 'ambulance',
      details: { dispatchId: updated.dispatchId, changedFields: Object.keys(parsed.data) },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[DISPATCH_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update dispatch', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
