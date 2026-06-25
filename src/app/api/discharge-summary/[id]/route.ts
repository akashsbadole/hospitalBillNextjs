import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const updateSummarySchema = z.object({
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/discharge-summary')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    const summary = await db.dischargeSummary.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, patientId: true, name: true } },
        visit: { select: { id: true, visitId: true, visitType: true, stage: true, status: true } },
      },
    })

    if (!summary) {
      return NextResponse.json({ error: 'Discharge summary not found' }, { status: 404 })
    }

    return NextResponse.json({ data: summary })
  } catch (error) {
    console.error('[DISCHARGE_SUMMARY_ID_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch discharge summary', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/discharge-summary')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    const existing = await db.dischargeSummary.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Discharge summary not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = updateSummarySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const dischargeSummary = await db.dischargeSummary.update({
      where: { id },
      data: {
        ...(data.admissionDate !== undefined && { admissionDate: data.admissionDate }),
        ...(data.dischargeDate !== undefined && { dischargeDate: data.dischargeDate }),
        ...(data.admittingDoctor !== undefined && { admittingDoctor: data.admittingDoctor }),
        ...(data.diagnosis !== undefined && { diagnosis: data.diagnosis }),
        ...(data.diagnosisDetails !== undefined && { diagnosisDetails: data.diagnosisDetails }),
        ...(data.treatmentSummary !== undefined && { treatmentSummary: data.treatmentSummary }),
        ...(data.procedurePerformed !== undefined && { procedurePerformed: data.procedurePerformed }),
        ...(data.dischargeMedications !== undefined && { dischargeMedications: data.dischargeMedications }),
        ...(data.followUpAdvice !== undefined && { followUpAdvice: data.followUpAdvice }),
        ...(data.followUpDays !== undefined && { followUpDays: data.followUpDays }),
        ...(data.followUpDoctorId !== undefined && { followUpDoctorId: data.followUpDoctorId }),
        ...(data.dietAdvice !== undefined && { dietAdvice: data.dietAdvice }),
        ...(data.activityAdvice !== undefined && { activityAdvice: data.activityAdvice }),
        ...(data.instructions !== undefined && { instructions: data.instructions }),
        ...(data.conditionAtDischarge !== undefined && { conditionAtDischarge: data.conditionAtDischarge }),
        ...(data.createdBy !== undefined && { createdBy: data.createdBy }),
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
      action: 'UPDATE',
      module: 'patients',
      details: { summaryId: existing.summaryId, patientId: existing.patientId },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: dischargeSummary })
  } catch (error) {
    console.error('[DISCHARGE_SUMMARY_ID_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update discharge summary', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/discharge-summary')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'DELETE')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    const existing = await db.dischargeSummary.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Discharge summary not found' }, { status: 404 })
    }

    await db.dischargeSummary.delete({ where: { id } })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'DELETE',
      module: 'patients',
      details: { summaryId: existing.summaryId, patientId: existing.patientId },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: { message: 'Discharge summary deleted' } })
  } catch (error) {
    console.error('[DISCHARGE_SUMMARY_ID_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete discharge summary', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
