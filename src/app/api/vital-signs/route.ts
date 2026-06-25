import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const createVitalsSchema = z.object({
  patientId: z.string().trim().min(1, 'Patient ID is required'),
  visitId: z.string().trim().optional(),
  bpSystolic: z.number().int().positive().optional(),
  bpDiastolic: z.number().int().positive().optional(),
  pulse: z.number().int().positive().optional(),
  temperature: z.number().optional(),
  spo2: z.number().int().min(0).max(100).optional(),
  respiratoryRate: z.number().int().positive().optional(),
  bloodSugar: z.number().optional(),
  painScale: z.number().int().min(0).max(10).optional(),
  recordedBy: z.string().trim().optional(),
  notes: z.string().trim().optional(),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/vital-signs')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const patientId = searchParams.get('patientId')
    const visitId = searchParams.get('visitId')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    const where: Record<string, unknown> = {}
    if (patientId) where.patientId = patientId
    if (visitId) where.visitId = visitId
    if (fromDate || toDate) {
      const dateFilter: Record<string, unknown> = {}
      if (fromDate) dateFilter.gte = new Date(fromDate)
      if (toDate) dateFilter.lte = new Date(toDate)
      where.recordedAt = dateFilter
    }

    const vitalSigns = await db.vitalSigns.findMany({
      where,
      orderBy: { recordedAt: 'desc' },
      include: {
        patient: { select: { id: true, patientId: true, name: true } },
        visit: { select: { id: true, visitId: true, visitType: true } },
      },
    })

    return NextResponse.json({ data: vitalSigns })
  } catch (error) {
    console.error('[VITAL_SIGNS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch vital signs', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/vital-signs')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createVitalsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const patient = await db.patient.findUnique({ where: { id: data.patientId } })
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const vitals = await db.vitalSigns.create({
      data: {
        patientId: data.patientId,
        visitId: data.visitId ?? null,
        bpSystolic: data.bpSystolic ?? null,
        bpDiastolic: data.bpDiastolic ?? null,
        pulse: data.pulse ?? null,
        temperature: data.temperature ?? null,
        spo2: data.spo2 ?? null,
        respiratoryRate: data.respiratoryRate ?? null,
        bloodSugar: data.bloodSugar ?? null,
        painScale: data.painScale ?? null,
        recordedBy: data.recordedBy ?? null,
        notes: data.notes ?? null,
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
      details: { vitalSignsId: vitals.id, patientId: data.patientId },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: vitals }, { status: 201 })
  } catch (error) {
    console.error('[VITAL_SIGNS_POST]', error)
    return NextResponse.json(
      { error: 'Failed to record vital signs', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
