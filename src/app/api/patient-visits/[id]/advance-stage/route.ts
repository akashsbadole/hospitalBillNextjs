import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'
import { VISIT_STAGES } from '../../route'

// ── Schema ──────────────────────────────────────────────────────────────
const advanceStageSchema = z.object({
  stage: z.string().trim().min(1, 'Stage name is required'),
  notes: z.string().trim().optional(),
})

// ── POST ─────────────────────────────────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/patient-visits')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    const body = await request.json()

    const parsed = advanceStageSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { stage: newStage, notes } = parsed.data

    // Validate the requested stage is valid
    if (!VISIT_STAGES.includes(newStage as typeof VISIT_STAGES[number])) {
      return NextResponse.json(
        { error: 'Invalid stage', details: `Must be one of: ${VISIT_STAGES.join(', ')}` },
        { status: 400 }
      )
    }

    // Fetch existing visit with stages
    const visit = await db.patientVisit.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, patientId: true, name: true, phone: true } },
        stages: { orderBy: { createdAt: 'asc' } },
      },
    })

    if (!visit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 })
    }

    // Validate visit is active
    if (visit.status !== 'Active') {
      return NextResponse.json(
        { error: `Visit is ${visit.status.toLowerCase()}. Only active visits can advance stages.` },
        { status: 400 }
      )
    }

    const currentStageIndex = VISIT_STAGES.indexOf(visit.stage as typeof VISIT_STAGES[number])
    const newStageIndex = VISIT_STAGES.indexOf(newStage as typeof VISIT_STAGES[number])

    // Validate forward-only transition
    if (newStageIndex <= currentStageIndex) {
      return NextResponse.json(
        { error: 'Invalid stage transition', details: newStage === visit.stage
          ? `Visit is already at ${newStage} stage`
          : `Cannot go backward from ${visit.stage} to ${newStage}` },
        { status: 400 }
      )
    }

    // Mark current active stage as Completed
    const currentStageRecord = visit.stages.find(s => s.stage === visit.stage && s.status === 'Active')
    if (currentStageRecord) {
      await db.visitStage.update({
        where: { id: currentStageRecord.id },
        data: {
          status: 'Completed',
          completedAt: new Date(),
          completedById: auth.user!.id,
          notes: notes || currentStageRecord.notes,
        },
      })
    }

    // Mark all skipped stages between current and new as Skipped
    for (let i = currentStageIndex + 1; i < newStageIndex; i++) {
      const skipStageRecord = visit.stages.find(s => s.stage === VISIT_STAGES[i] && s.status === 'Pending')
      if (skipStageRecord) {
        await db.visitStage.update({
          where: { id: skipStageRecord.id },
          data: { status: 'Skipped' },
        })
      }
    }

    // Mark new stage as Active
    const newStageRecord = visit.stages.find(s => s.stage === newStage && s.status === 'Pending')
    if (newStageRecord) {
      await db.visitStage.update({
        where: { id: newStageRecord.id },
        data: { status: 'Active' },
      })
    }

    // Update the visit record with new stage
    const updatedVisit = await db.patientVisit.update({
      where: { id },
      data: { stage: newStage },
      include: {
        patient: { select: { id: true, patientId: true, name: true, phone: true } },
        stages: { orderBy: { createdAt: 'asc' } },
        _count: { select: { analyses: true } },
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'STATUS_CHANGE',
      module: 'patient-visits',
      details: {
        visitId: visit.visitId,
        patientId: visit.patient.patientId,
        patientName: visit.patient.name,
        fromStage: visit.stage,
        toStage: newStage,
        notes,
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: updatedVisit })
  } catch (error) {
    console.error('[PATIENT_VISIT_ADVANCE_STAGE]', error)
    return NextResponse.json(
      { error: 'Failed to advance visit stage', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
