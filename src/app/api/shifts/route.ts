import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generateShiftId } from '@/lib/utils'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const createShiftSchema = z.object({
  name: z.string().trim().min(1, 'Shift name is required').max(100),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'End time must be HH:MM'),
  daysOfWeek: z.string().trim().min(1, 'Days of week is required'),
  gracePeriod: z.number().int().min(0).default(15),
  branchId: z.string().trim().optional(),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/shifts')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const isActive = searchParams.get('isActive')

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    const [shifts, total] = await Promise.all([
      db.shift.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          branch: { select: { id: true, branchId: true, name: true, code: true } },
        },
      }),
      db.shift.count({ where }),
    ])

    return NextResponse.json({
      data: shifts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[SHIFTS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch shifts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/shifts')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createShiftSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const lastShift = await db.shift.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { shiftId: true },
    })
    const shiftId = generateShiftId(lastShift?.shiftId ?? null)

    const shift = await db.shift.create({
      data: {
        shiftId,
        name: data.name,
        startTime: data.startTime,
        endTime: data.endTime,
        daysOfWeek: data.daysOfWeek,
        gracePeriod: data.gracePeriod,
        branchId: data.branchId ?? null,
      },
      include: {
        branch: { select: { id: true, branchId: true, name: true, code: true } },
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'shifts' as any,
      details: { shiftId: shift.shiftId, name: data.name },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: shift }, { status: 201 })
  } catch (error) {
    console.error('[SHIFTS_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create shift', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
