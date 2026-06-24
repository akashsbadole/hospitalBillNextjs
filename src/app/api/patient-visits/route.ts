import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generateVisitId } from '@/lib/utils'
import { authenticateRequest, checkWritePermission, getTenantFilter, getCreateBranchId } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── Constants ────────────────────────────────────────────────────────────
export const VISIT_STAGES = [
  'Registration', 'Triage', 'Waiting', 'In-Consultation',
  'Lab-Ordered', 'Lab-Done', 'Prescribed', 'Billed', 'Paid', 'Discharged',
] as const

const VALID_STATUSES = ['Active', 'Completed', 'Cancelled'] as const

// ── Schemas ──────────────────────────────────────────────────────────────
const vitalsSchema = z.object({
  temperature: z.string().optional(),
  bloodPressure: z.string().optional(),
  pulse: z.string().optional(),
  oxygenLevel: z.string().optional(),
  weight: z.string().optional(),
  height: z.string().optional(),
})

const createVisitSchema = z.object({
  patientId: z.string().trim().min(1, 'Patient ID is required'),
  appointmentId: z.string().trim().optional(),
  doctorId: z.string().trim().optional(),
  chiefComplaint: z.string().trim().min(1, 'Chief complaint is required').max(1000),
  vitals: vitalsSchema.optional(),
  notes: z.string().trim().optional(),
  visitType: z.enum(['OPD', 'IPD', 'Emergency', 'Follow-up']).optional().default('OPD'),
  department: z.string().trim().optional(),
  bedId: z.string().trim().optional(),
})

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/patient-visits')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const status = searchParams.get('status')
    const stage = searchParams.get('stage')
    const patientId = searchParams.get('patientId')
    const doctorId = searchParams.get('doctorId')

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    if (status && !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      return NextResponse.json(
        { error: 'Invalid status filter', details: `Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    if (stage && !VISIT_STAGES.includes(stage as typeof VISIT_STAGES[number])) {
      return NextResponse.json(
        { error: 'Invalid stage filter', details: `Must be one of: ${VISIT_STAGES.join(', ')}` },
        { status: 400 }
      )
    }

    const where: Record<string, unknown> = { ...getTenantFilter(auth.role, auth.branchId, request) }
    if (status) where.status = status
    if (stage) where.stage = stage
    if (patientId) where.patientId = patientId
    if (doctorId) where.doctorId = doctorId

    const [visits, total] = await Promise.all([
      db.patientVisit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: { select: { id: true, patientId: true, name: true, phone: true } },
          stages: { orderBy: { createdAt: 'asc' } },
          _count: { select: { analyses: true } },
        },
      }),
      db.patientVisit.count({ where }),
    ])

    // Enrich with doctor name and appointment aptId (no Prisma relation exists)
    const doctorIds = [...new Set(visits.map(v => v.doctorId).filter(Boolean))] as string[]
    const appointmentIds = [...new Set(visits.map(v => v.appointmentId).filter(Boolean))] as string[]

    const [doctors, appointments] = await Promise.all([
      doctorIds.length > 0
        ? db.doctor.findMany({ where: { id: { in: doctorIds } }, select: { id: true, doctorId: true, name: true } })
        : [] as { id: string; doctorId: string; name: string }[],
      appointmentIds.length > 0
        ? db.appointment.findMany({ where: { id: { in: appointmentIds } }, select: { id: true, aptId: true } })
        : [] as { id: string; aptId: string }[],
    ])

    const doctorMap = new Map<string, { id: string; doctorId: string; name: string }>(doctors.map(d => [d.id, d]))
    const appointmentMap = new Map<string, { id: string; aptId: string }>(appointments.map(a => [a.id, a]))

    const enrichedVisits = visits.map(visit => {
      const { doctorId: _docId, appointmentId: _aptId, ...rest } = visit
      return {
        ...rest,
        doctorName: visit.doctorId ? (doctorMap.get(visit.doctorId)?.name ?? null) : null,
        appointmentAptId: visit.appointmentId ? (appointmentMap.get(visit.appointmentId)?.aptId ?? null) : null,
        vitals: {
          temperature: visit.temperature,
          bloodPressure: visit.bloodPressure,
          pulse: visit.pulse,
          oxygenLevel: visit.oxygenLevel,
          weight: visit.weight,
          height: visit.height,
        },
      } as unknown as typeof visit
    })

    return NextResponse.json({
      data: enrichedVisits,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[PATIENT_VISITS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch patient visits', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── POST ─────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/patient-visits')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()

    const parsed = createVisitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Validate patient exists
    const patient = await db.patient.findUnique({ where: { id: data.patientId } })
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Validate doctor exists if provided
    if (data.doctorId) {
      const doctor = await db.doctor.findUnique({ where: { id: data.doctorId } })
      if (!doctor) {
        return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
      }
    }

    // Validate appointment belongs to patient if provided
    if (data.appointmentId) {
      const appointment = await db.appointment.findUnique({ where: { id: data.appointmentId } })
      if (!appointment) {
        return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
      }
      if (appointment.patientId !== data.patientId) {
        return NextResponse.json(
          { error: 'Appointment does not belong to this patient' },
          { status: 400 }
        )
      }
    }

    // Validate bed allocation for IPD
    let bedData: { bedNumber: string; dailyRate: number; wardName: string } | null = null
    if (data.bedId) {
      const bed = await db.bed.findUnique({
        where: { id: data.bedId },
        include: { ward: { select: { name: true } } },
      })
      if (!bed) {
        return NextResponse.json({ error: 'Bed not found' }, { status: 404 })
      }
      if (bed.status !== 'Available') {
        return NextResponse.json(
          { error: 'Bed is not available', details: `Current status: ${bed.status}` },
          { status: 400 }
        )
      }
      bedData = { bedNumber: bed.bedNumber, dailyRate: bed.dailyRate, wardName: bed.ward.name }
    }

    // Generate visitId
    const lastVisit = await db.patientVisit.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { visitId: true },
    })
    const visitId = generateVisitId(lastVisit?.visitId ?? null)

    // Determine if vitals were provided to set Triage stage status
    const hasVitals = data.vitals && Object.values(data.vitals).some(v => v !== undefined && v !== '')

    // Create visit with all initial stage records
    const now = new Date()
    const stageRecords = VISIT_STAGES.map(stageName => {
      if (stageName === 'Registration') {
        return {
          stage: stageName,
          status: 'Completed' as const,
          completedAt: now,
          notes: 'Auto-completed at registration',
        }
      }
      if (stageName === 'Triage' && hasVitals) {
        return {
          stage: stageName,
          status: 'Active' as const,
        }
      }
      return {
        stage: stageName,
        status: 'Pending' as const,
      }
    })

    const today = new Date().toISOString().split('T')[0]

    const createBranchId = getCreateBranchId(auth.role, auth.branchId, request, body.branchId)
    const visit = await db.$transaction(async (tx) => {
      const newVisit = await tx.patientVisit.create({
        data: {
          visitId,
          patientId: data.patientId,
          appointmentId: data.appointmentId || null,
          doctorId: data.doctorId || null,
          stage: hasVitals ? 'Triage' : 'Registration',
          status: 'Active',
          visitType: data.visitType,
          department: data.department || null,
          chiefComplaint: data.chiefComplaint,
          notes: data.notes || null,
          branchId: createBranchId,
          temperature: data.vitals?.temperature || null,
          bloodPressure: data.vitals?.bloodPressure || null,
          pulse: data.vitals?.pulse || null,
          oxygenLevel: data.vitals?.oxygenLevel || null,
          weight: data.vitals?.weight || null,
          height: data.vitals?.height || null,
          admissionDate: data.visitType === 'IPD' ? today : null,
          roomNumber: bedData ? `${bedData.wardName} - ${bedData.bedNumber}` : null,
          stages: {
            create: stageRecords,
          },
        },
        include: {
          patient: { select: { id: true, patientId: true, name: true, phone: true } },
          stages: { orderBy: { createdAt: 'asc' } },
          _count: { select: { analyses: true } },
        },
      })

      // Allocate bed for IPD if provided
      if (data.bedId) {
        await tx.bed.update({
          where: { id: data.bedId },
          data: {
            status: 'Occupied',
            currentPatientId: data.patientId,
            currentVisitId: newVisit.id,
            admittedAt: new Date(),
          },
        })
      }

      return newVisit
    })

    logAudit({
      userId: auth.userId!,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'patient-visits',
      details: {
        visitId: visit.visitId,
        patientId: patient.patientId,
        patientName: patient.name,
        chiefComplaint: data.chiefComplaint,
        initialStage: hasVitals ? 'Triage' : 'Registration',
        visitType: data.visitType,
        department: data.department,
        bed: bedData ? `${bedData.wardName} - ${bedData.bedNumber}` : undefined,
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: visit }, { status: 201 })
  } catch (error) {
    console.error('[PATIENT_VISITS_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create patient visit', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
