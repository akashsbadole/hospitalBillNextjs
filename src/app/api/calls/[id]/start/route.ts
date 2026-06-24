import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── POST — Start a call session ──────────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/calls')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
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

    if (existing.status !== 'Scheduled') {
      return NextResponse.json(
        { error: 'Call cannot be started', details: `Current status is "${existing.status}". Only scheduled calls can be started.` },
        { status: 400 }
      )
    }

    const now = new Date()

    const updated = await db.callSession.update({
      where: { id },
      data: {
        status: 'In-Progress',
        startedAt: now,
      },
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
      action: 'STATUS_CHANGE',
      module: 'calls',
      details: {
        callId: id,
        sessionId: existing.sessionId,
        action: 'call_started',
        startedAt: now.toISOString(),
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[CALL_START]', error)
    return NextResponse.json(
      { error: 'Failed to start call session', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
