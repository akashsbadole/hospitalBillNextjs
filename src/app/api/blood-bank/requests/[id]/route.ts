import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as const
const REQUEST_STATUSES = ['Pending', 'Approved', 'Crossmatched', 'Issued', 'Partially-Issued', 'Cancelled'] as const

const updateRequestSchema = z.object({
  status: z.enum(REQUEST_STATUSES).optional(),
  approvedBy: z.string().optional(),
  issuedBy: z.string().optional(),
  issuedAt: z.string().optional(),
  notes: z.string().trim().max(2000).optional(),
  unitsRequired: z.number().int().min(1).optional(),
  urgency: z.enum(['Normal', 'Urgent', 'Emergency']).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/blood-bank')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 })
    }

    const bloodRequest = await db.bloodRequest.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, patientId: true, name: true, bloodGroup: true, phone: true } },
        doctor: { select: { id: true, doctorId: true, name: true, specialization: true } },
      },
    })

    if (!bloodRequest) {
      return NextResponse.json({ error: 'Blood request not found' }, { status: 404 })
    }

    return NextResponse.json({ data: bloodRequest })
  } catch (error) {
    console.error('[BLOOD_REQUEST_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch blood request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/blood-bank')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 })
    }

    const existing = await db.bloodRequest.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Blood request not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = updateRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Auto-handle approve/issue logic
    if (data.status === 'Approved' && !data.approvedBy) {
      data.approvedBy = auth.userId!
    }
    if (data.status === 'Issued' && !data.issuedBy) {
      data.issuedBy = auth.userId!
      data.issuedAt = new Date().toISOString()
    }

    const updateData: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) updateData[key] = value
    }

    const bloodRequest = await db.bloodRequest.update({
      where: { id },
      data: updateData,
      include: {
        patient: { select: { id: true, patientId: true, name: true } },
        doctor: { select: { id: true, doctorId: true, name: true } },
      },
    })

    // If issued, deduct from inventory
    if (data.status === 'Issued' || data.status === 'Partially-Issued') {
      const inv = await db.bloodInventory.findUnique({
        where: { bloodGroup: bloodRequest.bloodGroup },
      })
      if (inv && inv.unitsAvailable > 0) {
        const deduct = data.status === 'Partially-Issued'
          ? Math.min(1, inv.unitsAvailable)
          : Math.min(bloodRequest.unitsRequired, inv.unitsAvailable)
        await db.bloodInventory.update({
          where: { bloodGroup: bloodRequest.bloodGroup },
          data: { unitsAvailable: Math.max(0, inv.unitsAvailable - deduct) },
        })
      }
    }

    logAudit({
      userId: auth.userId!,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'UPDATE',
      module: 'blood-bank',
      details: {
        requestId: bloodRequest.requestId,
        status: data.status || existing.status,
        changedFields: Object.keys(data),
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: bloodRequest })
  } catch (error) {
    console.error('[BLOOD_REQUEST_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update blood request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
