import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission, getTenantFilter, getCreateBranchId } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── Constants ─────────────────────────────────────────────────────────────
const WASTE_TYPES = ['Biomedical', 'Chemical', 'General', 'Sharps', 'Radioactive'] as const
const WASTE_CATEGORIES = ['Red', 'Yellow', 'Blue', 'White', 'Black'] as const
const DISPOSAL_METHODS = ['Autoclave', 'Incineration', 'Chemical Treatment', 'Landfill'] as const
const STATUSES = ['Pending', 'Processed', 'Completed'] as const

// ── Schemas ──────────────────────────────────────────────────────────────
const createWasteDisposalSchema = z.object({
  wasteType: z.enum(WASTE_TYPES),
  category: z.enum(WASTE_CATEGORIES),
  quantity: z.number().min(0, 'Quantity cannot be negative').default(0),
  disposalMethod: z.enum(DISPOSAL_METHODS),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  vehicleNo: z.string().trim().max(50).optional(),
  agencyName: z.string().trim().max(200).optional(),
  certificateNo: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(2000).optional(),
})

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/waste')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const status = searchParams.get('status')
    const wasteType = searchParams.get('wasteType')
    const category = searchParams.get('category')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    if (status && !STATUSES.includes(status as typeof STATUSES[number])) {
      return NextResponse.json(
        { error: 'Invalid status filter', details: `Must be one of: ${STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    const tenantFilter = getTenantFilter(auth.role, auth.branchId, request)

    const where: Record<string, unknown> = { ...tenantFilter }
    if (status) where.status = status
    if (wasteType) where.wasteType = wasteType
    if (category) where.category = category
    if (dateFrom || dateTo) {
      where.date = {}
      if (dateFrom) (where.date as Record<string, unknown>).gte = dateFrom
      if (dateTo) (where.date as Record<string, unknown>).lte = dateTo
    }

    const [records, total] = await Promise.all([
      db.wasteDisposal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.wasteDisposal.count({ where }),
    ])

    // Summary
    const summary = await db.wasteDisposal.aggregate({
      where: { ...tenantFilter },
      _sum: { quantity: true },
      _count: true,
    })

    return NextResponse.json({
      data: records,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        totalQuantity: summary._sum.quantity || 0,
        totalCount: summary._count,
      },
    })
  } catch (error) {
    console.error('[WASTE_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch waste disposal records', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── POST ─────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/waste')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createWasteDisposalSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data
    const createBranchId = getCreateBranchId(auth.role, auth.branchId, request, body.branchId)

    // Auto-generate disposalId
    const lastRecord = await db.wasteDisposal.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { disposalId: true },
    })
    const lastNum = lastRecord?.disposalId ? parseInt(lastRecord.disposalId.replace('WST-', ''), 10) : 0
    const disposalId = `WST-${String(lastNum + 1).padStart(4, '0')}`

    const record = await db.wasteDisposal.create({
      data: {
        disposalId,
        wasteType: data.wasteType,
        category: data.category,
        quantity: data.quantity,
        disposalMethod: data.disposalMethod,
        date: data.date,
        vehicleNo: data.vehicleNo,
        agencyName: data.agencyName,
        certificateNo: data.certificateNo,
        notes: data.notes,
        branchId: createBranchId,
        createdById: auth.userId!,
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
      module: 'waste',
      details: { disposalId, wasteType: data.wasteType, quantity: data.quantity },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    })

    return NextResponse.json({ data: record }, { status: 201 })
  } catch (error) {
    console.error('[WASTE_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create waste disposal record', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
