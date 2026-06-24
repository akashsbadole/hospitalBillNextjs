import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generatePrescriptionId } from '@/lib/utils'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'
import { VISIT_STAGES } from '../../route'

// ── Schemas ──────────────────────────────────────────────────────────────
const medicineSchema = z.object({
  medicine: z.string().trim().min(1, 'Medicine name is required'),
  dosage: z.string().trim().optional(),
  frequency: z.string().trim().optional(),
  duration: z.string().trim().optional(),
})

const createPrescriptionSchema = z.object({
  diagnosis: z.string().trim().min(1, 'Diagnosis is required'),
  medicines: z.array(medicineSchema).min(1, 'At least one medicine is required').max(50),
  notes: z.string().trim().optional(),
})

// ── POST: Create prescription from workflow and advance to Prescribed ───
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

    const parsed = createPrescriptionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Fetch visit
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

    if (visit.status !== 'Active') {
      return NextResponse.json(
        { error: `Visit is ${visit.status.toLowerCase()}. Only active visits can be prescribed.` },
        { status: 400 }
      )
    }

    if (!visit.doctorId) {
      return NextResponse.json(
        { error: 'Visit has no assigned doctor', details: 'Cannot create prescription without a doctor assignment.' },
        { status: 400 }
      )
    }

    // Helper: get stage index
    function stageIndex(stage: string): number {
      return VISIT_STAGES.indexOf(stage as typeof VISIT_STAGES[number])
    }

    const currentIdx = stageIndex(visit.stage)
    const prescribedIdx = stageIndex('Prescribed')

    // Visit must be at or before Prescribed stage (but past In-Consultation ideally)
    if (currentIdx >= stageIndex('Billed')) {
      return NextResponse.json(
        { error: 'Billing already completed', details: `Visit is already at "${visit.stage}" stage. Cannot add prescription.` },
        { status: 400 }
      )
    }

    // Auto-generate prescription ID
    const lastPrescription = await db.prescription.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { prescriptionId: true },
    })
    const prescriptionId = generatePrescriptionId(lastPrescription?.prescriptionId ?? null)

    const today = new Date().toISOString().split('T')[0]

    // Transaction: create prescription + advance stage
    const result = await db.$transaction(async (tx) => {
      // Create prescription
      const prescription = await tx.prescription.create({
        data: {
          prescriptionId,
          patientId: visit.patientId,
          doctorId: visit.doctorId!,
          date: today,
          diagnosis: data.diagnosis,
          notes: JSON.stringify(data.medicines),
        },
        include: {
          patient: { select: { id: true, patientId: true, name: true } },
          doctor: { select: { id: true, doctorId: true, name: true, specialization: true } },
        },
      })

      // Mark current active stage as Completed
      const currentStageRecord = visit.stages.find(s => s.stage === visit.stage && s.status === 'Active')
      if (currentStageRecord) {
        await tx.visitStage.update({
          where: { id: currentStageRecord.id },
          data: {
            status: 'Completed',
            completedAt: new Date(),
            completedById: auth.user!.id,
            notes: `Prescription ${prescriptionId} created — ${data.diagnosis}`,
          },
        })
      }

      // Skip intermediate stages between current and Prescribed
      for (let i = currentIdx + 1; i < prescribedIdx; i++) {
        const skipStageRecord = visit.stages.find(s => s.stage === VISIT_STAGES[i] && s.status === 'Pending')
        if (skipStageRecord) {
          await tx.visitStage.update({
            where: { id: skipStageRecord.id },
            data: { status: 'Skipped' },
          })
        }
      }

      // Mark Prescribed stage as Active
      const prescribedStageRecord = visit.stages.find(s => s.stage === 'Prescribed' && s.status === 'Pending')
      if (prescribedStageRecord) {
        await tx.visitStage.update({
          where: { id: prescribedStageRecord.id },
          data: { status: 'Active' },
        })
      }

      // Update visit current stage
      const updatedVisit = await tx.patientVisit.update({
        where: { id },
        data: { stage: 'Prescribed' },
        include: {
          patient: { select: { id: true, patientId: true, name: true, phone: true } },
          stages: { orderBy: { createdAt: 'asc' } },
          _count: { select: { analyses: true } },
        },
      })

      return { prescription, updatedVisit }
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'prescriptions',
      details: {
        prescriptionId: result.prescription.prescriptionId,
        patientId: visit.patient.patientId,
        patientName: visit.patient.name,
        visitId: visit.visitId,
        diagnosis: data.diagnosis,
        medicineCount: data.medicines.length,
        fromStage: visit.stage,
        toStage: 'Prescribed',
      },
      ...extractRequestInfo(request),
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
        toStage: 'Prescribed',
        reason: `Prescription ${result.prescription.prescriptionId} created`,
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({
      data: result.prescription,
      visit: result.updatedVisit,
    }, { status: 201 })
  } catch (error) {
    console.error('[VISIT_CREATE_PRESCRIPTION]', error)
    return NextResponse.json(
      { error: 'Failed to create prescription', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
