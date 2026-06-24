import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const updateAmbulanceSchema = z.object({
  vehicleNumber: z.string().trim().min(1).max(50).optional(),
  driverName: z.string().trim().min(1).max(100).optional(),
  driverPhone: z.string().trim().min(1).max(20).optional(),
  driverLicense: z.string().trim().max(50).optional(),
  type: z.enum(['Basic', 'Advanced', 'ICU', 'Mortuary']).optional(),
  status: z.enum(['Available', 'On-Duty', 'Maintenance', 'Out-of-Service']).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  equipment: z.string().optional(),
  hospitalBranch: z.string().trim().max(200).optional(),
  insuranceValidUntil: z.string().optional(),
  fitnessValidUntil: z.string().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/ambulance')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Ambulance ID is required' }, { status: 400 })
    }

    const ambulance = await db.ambulance.findUnique({
      where: { id },
      include: {
        dispatches: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    })

    if (!ambulance) {
      return NextResponse.json({ error: 'Ambulance not found' }, { status: 404 })
    }

    return NextResponse.json({ data: ambulance })
  } catch (error) {
    console.error('[AMBULANCE_ID_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch ambulance', details: error instanceof Error ? error.message : 'Unknown error' },
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
      return NextResponse.json({ error: 'Ambulance ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateAmbulanceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await db.ambulance.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Ambulance not found' }, { status: 404 })
    }

    if (parsed.data.vehicleNumber && parsed.data.vehicleNumber !== existing.vehicleNumber) {
      const dup = await db.ambulance.findUnique({ where: { vehicleNumber: parsed.data.vehicleNumber } })
      if (dup) {
        return NextResponse.json(
          { error: 'Vehicle number already exists', details: `"${parsed.data.vehicleNumber}" is already registered.` },
          { status: 409 }
        )
      }
    }

    const data: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) {
        if (key === 'insuranceValidUntil' || key === 'fitnessValidUntil') {
          data[key] = value ? new Date(value as string) : null
        } else {
          data[key] = value
        }
      }
    }

    const updated = await db.ambulance.update({ where: { id }, data })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'UPDATE',
      module: 'ambulance',
      details: { ambulanceId: updated.ambulanceId, changedFields: Object.keys(parsed.data) },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[AMBULANCE_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update ambulance', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/ambulance')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'DELETE')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Ambulance ID is required' }, { status: 400 })
    }

    const existing = await db.ambulance.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Ambulance not found' }, { status: 404 })
    }

    const activeDispatches = await db.ambulanceDispatch.count({
      where: { ambulanceId: id, status: { notIn: ['Completed', 'Cancelled'] } },
    })
    if (activeDispatches > 0) {
      return NextResponse.json(
        { error: 'Cannot delete ambulance with active dispatches', details: `${activeDispatches} active dispatch(es) exist.` },
        { status: 400 }
      )
    }

    await db.ambulance.delete({ where: { id } })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'DELETE',
      module: 'ambulance',
      details: { ambulanceId: existing.ambulanceId, vehicleNumber: existing.vehicleNumber },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: { id } })
  } catch (error) {
    console.error('[AMBULANCE_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete ambulance', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
