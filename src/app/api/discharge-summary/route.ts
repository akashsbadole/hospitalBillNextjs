import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generateDischargeId } from '@/lib/utils'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const createSummarySchema = z.object({
  visitId: z.string().trim().min(1, 'Visit ID is required'),
  patientId: z.string().trim().min(1, 'Patient ID is required'),
  admissionDate: z.string().optional(),
  dischargeDate: z.string().optional(),
  admittingDoctor: z.string().trim().optional(),
  diagnosis: z.string().trim().optional(),
  diagnosisDetails: z.string().trim().optional(),
  treatmentSummary: z.string().trim().optional(),
  procedurePerformed: z.string().trim().optional(),
  dischargeMedications: z.string().optional(),
  followUpAdvice: z.string().trim().optional(),
  followUpDays: z.number().int().positive().optional(),
  followUpDoctorId: z.string().trim().optional(),
  dietAdvice: z.string().trim().optional(),
  activityAdvice: z.string().trim().optional(),
  instructions: z.string().trim().optional(),
  conditionAtDischarge: z.string().trim().optional(),
  createdBy: z.string().trim().optional(),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/discharge-summary')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const patientId = searchParams.get('patientId')
    const visitId = searchParams.get('visitId')

    const where: Record<string, unknown> = {}
    if (patientId) where.patientId = patientId
    if (visitId) where.visitId = visitId

    const summaries = await db.dischargeSummary.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: { select: { id: true, patientId: true, name: true } },
        visit: { select: { id: true, visitId: true, visitType: true } },
      },
    })

    return NextResponse.json({ data: summaries })
  } catch (error) {
    console.error('[DISCHARGE_SUMMARY_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch discharge summaries', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/discharge-summary')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createSummarySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const [patient, visit] = await Promise.all([
      db.patient.findUnique({ where: { id: data.patientId } }),
      db.patientVisit.findUnique({ where: { id: data.visitId } }),
    ])

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }
    if (!visit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 })
    }

    const existingSummary = await db.dischargeSummary.findUnique({ where: { visitId: data.visitId } })
    if (existingSummary) {
      return NextResponse.json({ error: 'Discharge summary already exists for this visit' }, { status: 409 })
    }

    const lastSummary = await db.dischargeSummary.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { summaryId: true },
    })
    const summaryId = generateDischargeId(lastSummary?.summaryId ?? null)

    const dischargeSummary = await db.dischargeSummary.create({
      data: {
        summaryId,
        visitId: data.visitId,
        patientId: data.patientId,
        admissionDate: data.admissionDate ?? null,
        dischargeDate: data.dischargeDate ?? null,
        admittingDoctor: data.admittingDoctor ?? null,
        diagnosis: data.diagnosis ?? null,
        diagnosisDetails: data.diagnosisDetails ?? null,
        treatmentSummary: data.treatmentSummary ?? null,
        procedurePerformed: data.procedurePerformed ?? null,
        dischargeMedications: data.dischargeMedications ?? null,
        followUpAdvice: data.followUpAdvice ?? null,
        followUpDays: data.followUpDays ?? null,
        followUpDoctorId: data.followUpDoctorId ?? null,
        dietAdvice: data.dietAdvice ?? null,
        activityAdvice: data.activityAdvice ?? null,
        instructions: data.instructions ?? null,
        conditionAtDischarge: data.conditionAtDischarge ?? null,
        createdBy: data.createdBy ?? null,
      },
      include: {
        patient: { select: { id: true, patientId: true, name: true } },
        visit: { select: { id: true, visitId: true, visitType: true } },
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'patients',
      details: { summaryId: dischargeSummary.summaryId, patientId: data.patientId, visitId: data.visitId },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: dischargeSummary }, { status: 201 })
  } catch (error) {
    console.error('[DISCHARGE_SUMMARY_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create discharge summary', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
