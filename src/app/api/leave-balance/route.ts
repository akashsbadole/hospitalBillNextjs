import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const VALID_TYPES = ['Annual', 'Sick', 'Casual', 'Maternity', 'Paternity'] as const

const createLeaveBalanceSchema = z.object({
  staffId: z.string().trim().min(1, 'Staff ID is required'),
  type: z.enum(VALID_TYPES),
  totalDays: z.number().min(0, 'Total days must be non-negative'),
  usedDays: z.number().min(0).default(0),
  year: z.number().int().min(2020).max(2100),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/leave-balance')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { searchParams } = request.nextUrl
    const staffId = searchParams.get('staffId')
    const year = searchParams.get('year')

    const where: Record<string, unknown> = {}
    if (staffId) where.staffId = staffId
    if (year) where.year = parseInt(year, 10)

    const [balances, total] = await Promise.all([
      db.leaveBalance.findMany({
        where,
        orderBy: [{ year: 'desc' }, { type: 'asc' }],
        include: {
          staff: { select: { id: true, staffId: true, name: true, role: true } },
        },
      }),
      db.leaveBalance.count({ where }),
    ])

    return NextResponse.json({
      data: balances,
      total,
    })
  } catch (error) {
    console.error('[LEAVE_BALANCE_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch leave balances', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/leave-balance')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createLeaveBalanceSchema.safeParse(body)
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

    const balance = await db.leaveBalance.upsert({
      where: { staffId_type_year: { staffId: data.staffId, type: data.type, year: data.year } },
      create: {
        staffId: data.staffId,
        type: data.type,
        totalDays: data.totalDays,
        usedDays: data.usedDays,
        year: data.year,
      },
      update: {
        totalDays: data.totalDays,
        usedDays: data.usedDays,
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
      module: 'leave-balance' as any,
      details: { staffId: data.staffId, type: data.type, year: data.year, totalDays: data.totalDays, usedDays: data.usedDays },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: balance }, { status: 201 })
  } catch (error) {
    console.error('[LEAVE_BALANCE_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create/update leave balance', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
