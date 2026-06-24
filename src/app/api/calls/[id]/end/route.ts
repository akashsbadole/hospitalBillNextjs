import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── Schema ──────────────────────────────────────────────────────────────
const endCallSchema = z.object({
  notes: z.string().trim().optional(),
  diagnosis: z.string().trim().optional(),
  followUpNotes: z.string().trim().optional(),
  rating: z.number().int().min(1).max(5).optional(),
})

// ── POST — End a call session ──────────────────────────────────────────
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

    const body = await request.json()
    const parsed = endCallSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const existing = await db.callSession.findUnique({
      where: { id },
      include: {
        visit: { select: { id: true, visitId: true, stage: true } },
      },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Call session not found' }, { status: 404 })
    }

    if (existing.status !== 'In-Progress') {
      return NextResponse.json(
        { error: 'Call cannot be ended', details: `Current status is "${existing.status}". Only in-progress calls can be ended.` },
        { status: 400 }
      )
    }

    if (!existing.startedAt) {
      return NextResponse.json(
        { error: 'Call start time is missing. Cannot calculate duration.' },
        { status: 400 }
      )
    }

    const now = new Date()
    const durationSeconds = Math.round((now.getTime() - existing.startedAt.getTime()) / 1000)

    // Build update data
    const updateData: Record<string, unknown> = {
      status: 'Completed',
      endedAt: now,
      duration: durationSeconds,
    }
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.diagnosis !== undefined) updateData.diagnosis = data.diagnosis
    if (data.followUpNotes !== undefined) updateData.followUpNotes = data.followUpNotes
    if (data.rating !== undefined) updateData.rating = data.rating

    // Update the call session
    const updated = await db.callSession.update({
      where: { id },
      data: updateData,
      include: {
        patient: { select: { id: true, patientId: true, name: true, phone: true } },
        doctor: { select: { id: true, doctorId: true, name: true, specialization: true } },
        visit: { select: { id: true, visitId: true, stage: true, status: true } },
      },
    })

    // If a linked visit exists, advance it to Prescribed or Discharged stage
    if (existing.visit) {
      try {
        const currentStage = existing.visit.stage
        const newStage = ['Billed', 'Paid'].includes(currentStage) ? 'Discharged' : 'Prescribed'

        await db.patientVisit.update({
          where: { id: existing.visit.id },
          data: {
            stage: newStage,
            status: newStage === 'Discharged' ? 'Completed' : 'Active',
          },
        })
      } catch (visitError) {
        // Log the error but don't fail the call ending
        console.error('[CALL_END_VISIT_UPDATE]', visitError)
      }
    }

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
        action: 'call_ended',
        durationSeconds,
        hasDiagnosis: !!data.diagnosis,
        hasNotes: !!data.notes,
        rating: data.rating ?? null,
        linkedVisit: existing.visit?.visitId ?? null,
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[CALL_END]', error)
    return NextResponse.json(
      { error: 'Failed to end call session', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
