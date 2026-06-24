import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generateCallSessionId } from '@/lib/utils'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── Constants ──────────────────────────────────────────────────────────────
const VALID_STATUSES = ['Scheduled', 'In-Progress', 'Completed', 'Missed', 'Cancelled'] as const
const VALID_CALL_TYPES = ['Video', 'Audio', 'Chat'] as const

// ── Schemas ──────────────────────────────────────────────────────────────
const createCallSchema = z.object({
  appointmentId: z.string().trim().optional(),
  patientId: z.string().trim().min(1, 'Patient ID is required'),
  doctorId: z.string().trim().min(1, 'Doctor ID is required'),
  callType: z.enum(VALID_CALL_TYPES).default('Video'),
  scheduledAt: z.string().min(1, 'Scheduled date/time is required'),
  notes: z.string().trim().optional(),
})

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/calls')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl

    // Stats mode
    if (searchParams.get('stats') === 'true') {
      const [total, scheduled, inProgress, completed, missed, avgDurationResult] = await Promise.all([
        db.callSession.count(),
        db.callSession.count({ where: { status: 'Scheduled' } }),
        db.callSession.count({ where: { status: 'In-Progress' } }),
        db.callSession.count({ where: { status: 'Completed' } }),
        db.callSession.count({ where: { status: 'Missed' } }),
        db.callSession.aggregate({
          _avg: { duration: true },
          where: { status: 'Completed' },
        }),
      ])

      return NextResponse.json({
        data: {
          total,
          scheduled,
          inProgress,
          completed,
          missed,
          averageDuration: Math.round(avgDurationResult._avg.duration ?? 0),
        },
      })
    }

    // Paginated list mode
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const status = searchParams.get('status')
    const doctorId = searchParams.get('doctorId')
    const patientId = searchParams.get('patientId')
    const callType = searchParams.get('callType')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    if (status && !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      return NextResponse.json(
        { error: 'Invalid status filter', details: `Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    if (callType && !VALID_CALL_TYPES.includes(callType as typeof VALID_CALL_TYPES[number])) {
      return NextResponse.json(
        { error: 'Invalid call type filter', details: `Must be one of: ${VALID_CALL_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (doctorId) where.doctorId = doctorId
    if (patientId) where.patientId = patientId
    if (callType) where.callType = callType

    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {}
      if (dateFrom) dateFilter.gte = dateFrom
      if (dateTo) dateFilter.lte = dateTo
      where.scheduledAt = dateFilter
    }

    const [calls, total] = await Promise.all([
      db.callSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledAt: 'desc' },
        include: {
          patient: { select: { id: true, patientId: true, name: true, phone: true } },
          doctor: { select: { id: true, doctorId: true, name: true, specialization: true } },
          visit: { select: { id: true, visitId: true } },
        },
      }),
      db.callSession.count({ where }),
    ])

    return NextResponse.json({
      data: calls,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[CALLS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch calls', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── POST ─────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/calls')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createCallSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Validate patient and doctor exist
    const [patient, doctor] = await Promise.all([
      db.patient.findUnique({ where: { id: data.patientId } }),
      db.doctor.findUnique({ where: { id: data.doctorId } }),
    ])

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }
    if (!doctor) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }
    if (doctor.status !== 'Active') {
      return NextResponse.json({ error: 'Doctor is not active' }, { status: 400 })
    }

    // Validate appointment if provided
    if (data.appointmentId) {
      const appointment = await db.appointment.findUnique({
        where: { id: data.appointmentId },
      })
      if (!appointment) {
        return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
      }
      if (appointment.patientId !== data.patientId || appointment.doctorId !== data.doctorId) {
        return NextResponse.json(
          { error: 'Appointment does not belong to the specified patient and doctor' },
          { status: 400 }
        )
      }
    }

    // Auto-generate session ID
    const lastCall = await db.callSession.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { sessionId: true },
    })
    const sessionId = generateCallSessionId(lastCall?.sessionId ?? null)

    const callSession = await db.callSession.create({
      data: {
        sessionId,
        appointmentId: data.appointmentId ?? null,
        patientId: data.patientId,
        doctorId: data.doctorId,
        callType: data.callType,
        scheduledAt: data.scheduledAt,
        notes: data.notes ?? null,
        status: 'Scheduled',
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
      action: 'CREATE',
      module: 'calls',
      details: {
        sessionId: callSession.sessionId,
        patientName: callSession.patient.name,
        doctorName: callSession.doctor.name,
        callType: callSession.callType,
        scheduledAt: callSession.scheduledAt,
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: callSession }, { status: 201 })
  } catch (error) {
    console.error('[CALLS_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create call session', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
