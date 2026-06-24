import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── Constants ──────────────────────────────────────────────────────────────
const VALID_STATUSES = ['Scheduled', 'In-Progress', 'Completed', 'Missed', 'Cancelled'] as const

// ── Schemas ──────────────────────────────────────────────────────────────
const updateCallSchema = z.object({
  notes: z.string().trim().optional(),
  diagnosis: z.string().trim().optional(),
  followUpNotes: z.string().trim().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  status: z.enum(VALID_STATUSES).optional(),
})

const CALL_INCLUDE = {
  patient: { select: { id: true, patientId: true, name: true, phone: true, email: true } },
  doctor: { select: { id: true, doctorId: true, name: true, specialization: true, consultationFee: true } },
  visit: {
    select: {
      id: true,
      visitId: true,
      stage: true,
      status: true,
      chiefComplaint: true,
    },
  },
}

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/calls')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Call session ID is required' }, { status: 400 })
    }

    const call = await db.callSession.findUnique({
      where: { id },
      include: {
        ...CALL_INCLUDE,
        visit: {
          ...CALL_INCLUDE.visit,
          include: {
            analyses: {
              select: { id: true, analysisId: true, type: true, createdAt: true },
            },
          },
        },
      },
    })

    if (!call) {
      return NextResponse.json({ error: 'Call session not found' }, { status: 404 })
    }

    return NextResponse.json({ data: call })
  } catch (error) {
    console.error('[CALL_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch call session', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── PUT ──────────────────────────────────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/calls')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Call session ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateCallSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const existing = await db.callSession.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Call session not found' }, { status: 404 })
    }

    // Track status change
    const statusChange = data.status && data.status !== existing.status
      ? `${existing.status} → ${data.status}`
      : undefined

    const updated = await db.callSession.update({
      where: { id },
      data,
      include: {
        patient: { select: { id: true, patientId: true, name: true, phone: true } },
        doctor: { select: { id: true, doctorId: true, name: true, specialization: true } },
        visit: { select: { id: true, visitId: true } },
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'UPDATE',
      module: 'calls',
      details: {
        callId: id,
        sessionId: existing.sessionId,
        changedFields: Object.keys(data),
        ...(statusChange ? { statusChange } : {}),
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[CALL_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update call session', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── DELETE (soft delete → Cancelled) ────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/calls')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'DELETE')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Call session ID is required' }, { status: 400 })
    }

    const existing = await db.callSession.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Call session not found' }, { status: 404 })
    }

    if (existing.status === 'Cancelled') {
      return NextResponse.json({ error: 'Call session is already cancelled' }, { status: 400 })
    }

    if (existing.status === 'Completed') {
      return NextResponse.json({ error: 'Cannot cancel a completed call session' }, { status: 400 })
    }

    if (existing.status === 'In-Progress') {
      return NextResponse.json({ error: 'Cannot cancel an in-progress call. End the call first.' }, { status: 400 })
    }

    const callSession = await db.callSession.update({
      where: { id },
      data: { status: 'Cancelled' },
      include: {
        patient: { select: { id: true, patientId: true, name: true, phone: true } },
        doctor: { select: { id: true, doctorId: true, name: true, specialization: true } },
        visit: { select: { id: true, visitId: true } },
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'DELETE',
      module: 'calls',
      details: {
        callId: id,
        sessionId: existing.sessionId,
        previousStatus: existing.status,
        scheduledAt: existing.scheduledAt,
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: callSession })
  } catch (error) {
    console.error('[CALL_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to cancel call session', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
