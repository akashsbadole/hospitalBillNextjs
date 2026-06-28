import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const VALID_STATUSES = ['Present', 'Absent', 'Late', 'Half-Day', 'Holiday', 'Leave', 'Weekend'] as const

const createAttendanceSchema = z.object({
  staffId: z.string().trim().min(1, 'Staff ID is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  checkIn: z.string().regex(/^\d{2}:\d{2}$/, 'Check-in must be HH:MM').optional(),
  checkOut: z.string().regex(/^\d{2}:\d{2}$/, 'Check-out must be HH:MM').optional(),
  status: z.enum(VALID_STATUSES).default('Present'),
  notes: z.string().trim().optional(),
})

function calculateHoursWorked(checkIn: string | null | undefined, checkOut: string | null | undefined): number {
  if (!checkIn || !checkOut) return 0
  const [inH, inM] = checkIn.split(':').map(Number)
  const [outH, outM] = checkOut.split(':').map(Number)
  const inMinutes = inH * 60 + inM
  const outMinutes = outH * 60 + outM
  const diffMinutes = outMinutes - inMinutes
  return Math.max(0, Math.round((diffMinutes / 60) * 100) / 100)
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/attendance')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const staffId = searchParams.get('staffId')
    const date = searchParams.get('date')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    const status = searchParams.get('status')

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date format', details: 'Must be YYYY-MM-DD' }, { status: 400 })
    }
    if (fromDate && !/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
      return NextResponse.json({ error: 'Invalid fromDate format', details: 'Must be YYYY-MM-DD' }, { status: 400 })
    }
    if (toDate && !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      return NextResponse.json({ error: 'Invalid toDate format', details: 'Must be YYYY-MM-DD' }, { status: 400 })
    }
    if (status && !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      return NextResponse.json(
        { error: 'Invalid status filter', details: `Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    const where: Record<string, unknown> = {}
    if (staffId) where.staffId = staffId
    if (date) where.date = date
    if (status) where.status = status
    if (fromDate || toDate) {
      const dateFilter: Record<string, unknown> = {}
      if (fromDate) dateFilter.gte = fromDate
      if (toDate) dateFilter.lte = toDate
      where.date = dateFilter
    }

    const [attendanceList, total] = await Promise.all([
      db.attendance.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          staff: { select: { id: true, staffId: true, name: true, role: true } },
        },
      }),
      db.attendance.count({ where }),
    ])

    return NextResponse.json({
      data: attendanceList,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[ATTENDANCE_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch attendance records', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/attendance')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createAttendanceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const staff = await db.staff.findUnique({ where: { id: data.staffId } })
    if (!staff) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
    }

    const hoursWorked = calculateHoursWorked(data.checkIn, data.checkOut)

    const attendance = await db.attendance.upsert({
      where: { staffId_date: { staffId: data.staffId, date: data.date } },
      create: {
        staffId: data.staffId,
        date: data.date,
        checkIn: data.checkIn ?? null,
        checkOut: data.checkOut ?? null,
        hoursWorked,
        status: data.status,
        notes: data.notes ?? null,
      },
      update: {
        checkIn: data.checkIn ?? null,
        checkOut: data.checkOut ?? null,
        hoursWorked,
        status: data.status,
        notes: data.notes ?? null,
      },
      include: {
        staff: { select: { id: true, staffId: true, name: true, role: true } },
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'attendance',
      details: { attendanceId: attendance.id, staffId: data.staffId, date: data.date, status: data.status },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: attendance }, { status: 201 })
  } catch (error) {
    console.error('[ATTENDANCE_POST]', error)
    return NextResponse.json(
      { error: 'Failed to mark attendance', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
