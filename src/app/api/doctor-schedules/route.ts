import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission, getTenantFilter, getCreateBranchId } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── Constants ─────────────────────────────────────────────────────────────
const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const
const SCHEDULE_STATUSES = ['Active', 'Inactive', 'On Leave'] as const

// ── Schemas ──────────────────────────────────────────────────────────────
const createScheduleSchema = z.object({
  doctorId: z.string().trim().min(1, 'Doctor ID is required'),
  dayOfWeek: z.enum(DAYS_OF_WEEK),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'End time must be HH:MM'),
  maxAppointments: z.number().int().min(1, 'Max appointments must be at least 1').max(100).default(20),
  consultationFee: z.number().min(0, 'Consultation fee cannot be negative').default(0),
  isAvailable: z.boolean().default(true),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Effective from date must be YYYY-MM-DD').optional(),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Effective to date must be YYYY-MM-DD').optional(),
})

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/doctor-schedules')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const status = searchParams.get('status')
    const doctorId = searchParams.get('doctorId')
    const dayOfWeek = searchParams.get('dayOfWeek')

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 50 : Math.min(200, Math.max(1, parseInt(rawLimit || '50', 10)))
    const skip = (page - 1) * limit

    if (status && !SCHEDULE_STATUSES.includes(status as typeof SCHEDULE_STATUSES[number])) {
      return NextResponse.json(
        { error: 'Invalid status filter', details: `Must be one of: ${SCHEDULE_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    const tenantFilter = getTenantFilter(auth.role, auth.branchId, request)

    const where: Record<string, unknown> = { ...tenantFilter }
    if (status) where.status = status
    if (doctorId) where.doctorId = doctorId
    if (dayOfWeek) where.dayOfWeek = dayOfWeek

    const [schedules, total] = await Promise.all([
      db.doctorSchedule.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        include: {
          doctor: {
            select: { id: true, doctorId: true, name: true, specialization: true },
          },
        },
      }),
      db.doctorSchedule.count({ where }),
    ])

    return NextResponse.json({
      data: schedules,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[DOCTOR_SCHEDULES_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch doctor schedules', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── POST ─────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/doctor-schedules')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createScheduleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data
    const createBranchId = getCreateBranchId(auth.role, auth.branchId, request, body.branchId)

    // Auto-generate scheduleId
    const lastSchedule = await db.doctorSchedule.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { scheduleId: true },
    })
    const lastNum = lastSchedule?.scheduleId ? parseInt(lastSchedule.scheduleId.replace('SCH-', ''), 10) : 0
    const scheduleId = `SCH-${String(lastNum + 1).padStart(4, '0')}`

    const schedule = await db.doctorSchedule.create({
      data: {
        scheduleId,
        doctorId: data.doctorId,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        maxAppointments: data.maxAppointments,
        consultationFee: data.consultationFee,
        isAvailable: data.isAvailable,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo,
        branchId: createBranchId,
      },
      include: {
        doctor: {
          select: { id: true, doctorId: true, name: true, specialization: true },
        },
      },
    })

    // Audit log
    const reqInfo = extractRequestInfo(request)
    logAudit({
      userId: auth.userId!,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'doctor-schedules',
      details: { scheduleId, doctorId: data.doctorId, dayOfWeek: data.dayOfWeek },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    })

    return NextResponse.json({ data: schedule }, { status: 201 })
  } catch (error) {
    console.error('[DOCTOR_SCHEDULES_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create doctor schedule', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
