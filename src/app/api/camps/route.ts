import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generateCampId } from '@/lib/utils'
import { authenticateRequest, checkWritePermission, getTenantFilter, getCreateBranchId } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  campDate: z.string().min(1, 'Camp date is required'),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  location: z.string().min(1, 'Location is required'),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  organizer: z.string().optional(),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  campType: z.string().optional(),
  expectedCount: z.number().optional(),
  branchId: z.string().optional(),
  notes: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/camps')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const status = searchParams.get('status')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    const city = searchParams.get('city')

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    const tenantFilter = getTenantFilter(auth.role, auth.branchId, request)
    const where: Record<string, unknown> = { ...tenantFilter }
    if (status) where.status = status
    if (city) where.city = { contains: city, mode: 'insensitive' }
    if (fromDate || toDate) {
      const df: Record<string, string> = {}
      if (fromDate) df.gte = fromDate
      if (toDate) df.lte = toDate
      where.campDate = df
    }

    const [camps, total] = await Promise.all([
      db.healthCamp.findMany({
        where,
        skip,
        take: limit,
        orderBy: { campDate: 'desc' },
        include: {
          branch: { select: { id: true, name: true, code: true } },
          _count: { select: { registrations: true } },
        },
      }),
      db.healthCamp.count({ where }),
    ])

    return NextResponse.json({ data: camps, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('[CAMPS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch camps', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/camps')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const lastCamp = await db.healthCamp.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { campId: true },
    })
    const campId = generateCampId(lastCamp?.campId ?? null)

    const createBranchId = getCreateBranchId(auth.role, auth.branchId, request, data.branchId)
    const camp = await db.healthCamp.create({
      data: {
        campId,
        name: data.name,
        description: data.description ?? null,
        campDate: data.campDate,
        startTime: data.startTime ?? null,
        endTime: data.endTime ?? null,
        location: data.location,
        address: data.address ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        organizer: data.organizer ?? null,
        contactPerson: data.contactPerson ?? null,
        contactPhone: data.contactPhone ?? null,
        campType: data.campType ?? 'General',
        expectedCount: data.expectedCount ?? 0,
        branchId: createBranchId,
        notes: data.notes ?? null,
      },
      include: {
        branch: { select: { id: true, name: true } },
      },
    })

    logAudit({
      userId: auth.userId!,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'feedback',
      details: { campId: camp.campId, name: camp.name, campDate: camp.campDate },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: camp }, { status: 201 })
  } catch (error) {
    console.error('[CAMPS_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create camp', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
