import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'
import { VISIT_STAGES } from '../route'

// ── Schemas ──────────────────────────────────────────────────────────────
const vitalsSchema = z.object({
  temperature: z.string().optional(),
  bloodPressure: z.string().optional(),
  pulse: z.string().optional(),
  oxygenLevel: z.string().optional(),
  weight: z.string().optional(),
  height: z.string().optional(),
})

const updateVisitSchema = z.object({
  stage: z.string().trim().optional(),
  vitals: vitalsSchema.optional(),
  chiefComplaint: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  status: z.enum(['Active', 'Completed', 'Cancelled']).optional(),
  doctorId: z.string().trim().optional(),
})

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/patient-visits')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params

    const visit = await db.patientVisit.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, patientId: true, name: true, phone: true, email: true, gender: true, dateOfBirth: true, bloodGroup: true } },
        stages: { orderBy: { createdAt: 'asc' } },
        analyses: { orderBy: { createdAt: 'desc' } },
        callSession: { select: { id: true, sessionId: true, status: true, callType: true, scheduledAt: true, duration: true } },
        _count: { select: { analyses: true } },
      },
    })

    if (!visit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 })
    }

    // Enrich with doctor name and appointment aptId
    let doctorName: string | null = null
    let appointmentAptId: string | null = null

    if (visit.doctorId) {
      const doctor = await db.doctor.findUnique({ where: { id: visit.doctorId }, select: { name: true } })
      doctorName = doctor?.name ?? null
    }

    if (visit.appointmentId) {
      const appointment = await db.appointment.findUnique({ where: { id: visit.appointmentId }, select: { aptId: true } })
      appointmentAptId = appointment?.aptId ?? null
    }

    // Parse vitals as JSON object in response
    const response = {
      ...visit,
      doctorName,
      appointmentAptId,
      vitals: {
        temperature: visit.temperature,
        bloodPressure: visit.bloodPressure,
        pulse: visit.pulse,
        oxygenLevel: visit.oxygenLevel,
        weight: visit.weight,
        height: visit.height,
      },
    }

    return NextResponse.json({ data: response })
  } catch (error) {
    console.error('[PATIENT_VISIT_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch patient visit', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── PUT ──────────────────────────────────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/patient-visits')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    const body = await request.json()

    const parsed = updateVisitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Fetch existing visit
    const existingVisit = await db.patientVisit.findUnique({
      where: { id },
      include: { stages: { orderBy: { createdAt: 'asc' } } },
    })

    if (!existingVisit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 })
    }

    if (existingVisit.status === 'Completed' || existingVisit.status === 'Cancelled') {
      return NextResponse.json(
        { error: `Visit is already ${existingVisit.status.toLowerCase()} and cannot be updated` },
        { status: 400 }
      )
    }

    // Build update data
    const updateData: Record<string, unknown> = {}

    if (data.chiefComplaint !== undefined) updateData.chiefComplaint = data.chiefComplaint
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.status !== undefined) updateData.status = data.status
    if (data.doctorId !== undefined) updateData.doctorId = data.doctorId

    // Handle vitals update
    if (data.vitals) {
      if (data.vitals.temperature !== undefined) updateData.temperature = data.vitals.temperature
      if (data.vitals.bloodPressure !== undefined) updateData.bloodPressure = data.vitals.bloodPressure
      if (data.vitals.pulse !== undefined) updateData.pulse = data.vitals.pulse
      if (data.vitals.oxygenLevel !== undefined) updateData.oxygenLevel = data.vitals.oxygenLevel
      if (data.vitals.weight !== undefined) updateData.weight = data.vitals.weight
      if (data.vitals.height !== undefined) updateData.height = data.vitals.height
    }

    // Handle stage transition
    if (data.stage) {
      const newStage = data.stage

      // Validate the requested stage is valid
      if (!VISIT_STAGES.includes(newStage as typeof VISIT_STAGES[number])) {
        return NextResponse.json(
          { error: 'Invalid stage', details: `Must be one of: ${VISIT_STAGES.join(', ')}` },
          { status: 400 }
        )
      }

      const currentStageIndex = VISIT_STAGES.indexOf(existingVisit.stage as typeof VISIT_STAGES[number])
      const newStageIndex = VISIT_STAGES.indexOf(newStage as typeof VISIT_STAGES[number])

      // Validate forward-only transition
      if (newStageIndex < currentStageIndex) {
        return NextResponse.json(
          { error: 'Invalid stage transition', details: `Cannot go backward from ${existingVisit.stage} to ${newStage}` },
          { status: 400 }
        )
      }

      // Mark current active stage as Completed
      const currentStageRecord = existingVisit.stages.find(s => s.stage === existingVisit.stage && s.status === 'Active')
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

      // Mark all stages between current and new as Skipped (for jumping ahead)
      for (let i = currentStageIndex + 1; i < newStageIndex; i++) {
        const skipStageRecord = existingVisit.stages.find(s => s.stage === VISIT_STAGES[i] && s.status === 'Pending')
        if (skipStageRecord) {
          await db.visitStage.update({
            where: { id: skipStageRecord.id },
            data: { status: 'Skipped' },
          })
        }
      }

      // Mark new stage as Active
      const newStageRecord = existingVisit.stages.find(s => s.stage === newStage && (s.status === 'Pending' || s.status === 'Skipped'))
      if (newStageRecord) {
        await db.visitStage.update({
          where: { id: newStageRecord.id },
          data: { status: 'Active' },
        })
      }

      updateData.stage = newStage

      // If new stage is "Discharged", set status to "Completed"
      if (newStage === 'Discharged') {
        updateData.status = 'Completed'
        // Mark all remaining stages after Discharged as Skipped
        // (Discharged is last stage, so nothing to skip)
      }

      logAudit({
        userId: auth.user!.id,
        userName: auth.user!.email,
        userEmail: auth.user!.email,
        userRole: auth.role!,
        action: 'STATUS_CHANGE',
        module: 'patient-visits',
        details: {
          visitId: existingVisit.visitId,
          fromStage: existingVisit.stage,
          toStage: newStage,
        },
        ...extractRequestInfo(request),
      })
    }

    // Update the visit record
    const updatedVisit = await db.patientVisit.update({
      where: { id },
      data: updateData,
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
      action: 'UPDATE',
      module: 'patient-visits',
      details: {
        visitId: updatedVisit.visitId,
        updatedFields: Object.keys(updateData),
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: updatedVisit })
  } catch (error) {
    console.error('[PATIENT_VISIT_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update patient visit', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── DELETE ───────────────────────────────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/patient-visits')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'DELETE')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params

    const existingVisit = await db.patientVisit.findUnique({
      where: { id },
      include: { patient: { select: { patientId: true, name: true } } },
    })

    if (!existingVisit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 })
    }

    if (existingVisit.status === 'Completed') {
      return NextResponse.json(
        { error: 'Cannot cancel a completed visit' },
        { status: 400 }
      )
    }

    if (existingVisit.status === 'Cancelled') {
      return NextResponse.json(
        { error: 'Visit is already cancelled' },
        { status: 400 }
      )
    }

    // Soft cancel: set status to Cancelled
    const cancelledVisit = await db.patientVisit.update({
      where: { id },
      data: { status: 'Cancelled' },
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
      action: 'DELETE',
      module: 'patient-visits',
      details: {
        visitId: cancelledVisit.visitId,
        patientId: existingVisit.patient.patientId,
        patientName: existingVisit.patient.name,
        previousStage: existingVisit.stage,
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: cancelledVisit })
  } catch (error) {
    console.error('[PATIENT_VISIT_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to cancel patient visit', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
