import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'
import { VISIT_STAGES } from '../../route'

// ── Schema ──────────────────────────────────────────────────────────────
const completeVisitSchema = z.object({
  dischargeNotes: z.string().trim().optional(),
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

    const parsed = completeVisitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { dischargeNotes } = parsed.data

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
        { error: `Visit is already ${visit.status.toLowerCase()} and cannot be completed` },
        { status: 400 }
      )
    }

    const currentStageIndex = VISIT_STAGES.indexOf(visit.stage as typeof VISIT_STAGES[number])
    const dischargedIndex = VISIT_STAGES.indexOf('Discharged')

    // Mark current active stage as Completed (if not already at Discharged)
    if (visit.stage !== 'Discharged') {
      const currentStageRecord = visit.stages.find(s => s.stage === visit.stage && s.status === 'Active')
      if (currentStageRecord) {
        await db.visitStage.update({
          where: { id: currentStageRecord.id },
          data: {
            status: 'Completed',
            completedAt: new Date(),
            completedById: auth.user!.id,
          },
        })
      }

      // Mark all remaining Pending stages between current and Discharged as Skipped
      for (let i = currentStageIndex + 1; i < dischargedIndex; i++) {
        const skipStageRecord = visit.stages.find(s => s.stage === VISIT_STAGES[i] && s.status === 'Pending')
        if (skipStageRecord) {
          await db.visitStage.update({
            where: { id: skipStageRecord.id },
            data: { status: 'Skipped' },
          })
        }
      }

      // Mark Discharged stage as Completed (not just Active)
      const dischargedStageRecord = visit.stages.find(s => s.stage === 'Discharged')
      if (dischargedStageRecord) {
        await db.visitStage.update({
          where: { id: dischargedStageRecord.id },
          data: {
            status: 'Completed',
            completedAt: new Date(),
            completedById: auth.user!.id,
            notes: dischargeNotes || 'Patient discharged',
          },
        })
      }
    }

    // Update the visit record
    const updatedVisit = await db.patientVisit.update({
      where: { id },
      data: {
        stage: 'Discharged',
        status: 'Completed',
        notes: dischargeNotes
          ? [visit.notes, `Discharge: ${dischargeNotes}`].filter(Boolean).join('\n')
          : visit.notes,
      },
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
        toStage: 'Discharged',
        status: 'Completed',
        dischargeNotes,
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: updatedVisit })
  } catch (error) {
    console.error('[PATIENT_VISIT_COMPLETE]', error)
    return NextResponse.json(
      { error: 'Failed to complete patient visit', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
