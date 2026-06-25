import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generateLeaveId } from '@/lib/utils'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const VALID_TYPES = ['Annual', 'Sick', 'Casual', 'Maternity', 'Paternity', 'Bereavement', 'Unpaid'] as const
const VALID_STATUSES = ['Pending', 'Approved', 'Rejected', 'Cancelled'] as const

const createLeaveSchema = z.object({
  staffId: z.string().trim().min(1, 'Staff ID is required'),
  type: z.enum(VALID_TYPES),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'From date must be YYYY-MM-DD'),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'To date must be YYYY-MM-DD'),
  reason: z.string().trim().optional(),
})

function calculateTotalDays(fromDate: string, toDate: string): number {
  const from = new Date(fromDate)
  const to = new Date(toDate)
  const diffTime = to.getTime() - from.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1
  return Math.max(1, diffDays)
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/leaves')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const staffId = searchParams.get('staffId')
    const status = searchParams.get('status')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    if (fromDate && !/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
      return NextResponse.json({ error: 'Invalid fromDate format', details: 'Must be YYYY-MM-DD' }, { status: 400 })
    }
    if (toDate && !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      return NextResponse.json({ error: 'Invalid toDate format', details: 'Must be YYYY-MM-DD' }, { status: 400 })
    }

    const where: Record<string, unknown> = {}
    if (staffId) where.staffId = staffId
    if (status) where.status = status
    if (fromDate || toDate) {
      const dateFilter: Record<string, unknown> = {}
      if (fromDate) dateFilter.gte = fromDate
      if (toDate) dateFilter.lte = toDate
      where.fromDate = dateFilter
    }

    const [leaves, total] = await Promise.all([
      db.leave.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          staff: { select: { id: true, staffId: true, name: true, role: true, designation: true } },
        },
      }),
      db.leave.count({ where }),
    ])

    return NextResponse.json({
      data: leaves,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[LEAVES_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch leaves', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/leaves')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createLeaveSchema.safeParse(body)
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

    if (data.fromDate > data.toDate) {
      return NextResponse.json({ error: 'From date must be before or equal to to date' }, { status: 400 })
    }

    const totalDays = calculateTotalDays(data.fromDate, data.toDate)

    const lastLeave = await db.leave.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { leaveId: true },
    })
    const leaveId = generateLeaveId(lastLeave?.leaveId ?? null)

    const leave = await db.leave.create({
      data: {
        leaveId,
        staffId: data.staffId,
        type: data.type,
        fromDate: data.fromDate,
        toDate: data.toDate,
        totalDays,
        reason: data.reason ?? null,
      },
      include: {
        staff: { select: { id: true, staffId: true, name: true, role: true, designation: true } },
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'leaves' as any,
      details: { leaveId: leave.leaveId, staffId: data.staffId, type: data.type, fromDate: data.fromDate, toDate: data.toDate },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: leave }, { status: 201 })
  } catch (error) {
    console.error('[LEAVES_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create leave', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
