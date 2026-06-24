import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission, getTenantFilter, getCreateBranchId } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── Constants ─────────────────────────────────────────────────────────────
const STATUSES = ['Pending', 'Paid', 'Filed'] as const
const SECTIONS = ['194A', '194C', '194D', '194H', '194J', '194I', '194Q', '194BB'] as const
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const

// ── Schemas ──────────────────────────────────────────────────────────────
const createTdsSchema = z.object({
  panNumber: z.string().trim().max(10).optional(),
  recipientName: z.string().trim().min(1, 'Recipient name is required').max(200),
  amount: z.number().positive('Amount must be positive'),
  tdsRate: z.number().min(0).max(30).default(0),
  tdsAmount: z.number().min(0).default(0),
  section: z.enum(SECTIONS).default('194C'),
  quarter: z.enum(QUARTERS),
  fiscalYear: z.string().regex(/^\d{4}-\d{2}$/, 'Fiscal year must be YYYY-YY format'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be YYYY-MM-DD').optional(),
  challanNo: z.string().trim().max(50).optional(),
})

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/tds')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const status = searchParams.get('status')
    const section = searchParams.get('section')
    const quarter = searchParams.get('quarter')
    const fiscalYear = searchParams.get('fiscalYear')
    const search = searchParams.get('search')?.trim() || ''

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
    if (section) where.section = section
    if (quarter) where.quarter = quarter
    if (fiscalYear) where.fiscalYear = fiscalYear
    if (search) {
      where.OR = [
        { recipientName: { contains: search } },
        { panNumber: { contains: search } },
        { recordId: { contains: search } },
      ]
    }

    const [records, total] = await Promise.all([
      db.tdsRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.tdsRecord.count({ where }),
    ])

    // Summary
    const summary = await db.tdsRecord.aggregate({
      where: { ...tenantFilter },
      _sum: { amount: true, tdsAmount: true },
      _count: true,
    })

    return NextResponse.json({
      data: records,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        totalAmount: summary._sum.amount || 0,
        totalTds: summary._sum.tdsAmount || 0,
        totalCount: summary._count,
      },
    })
  } catch (error) {
    console.error('[TDS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch TDS records', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── POST ─────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/tds')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createTdsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data
    const createBranchId = getCreateBranchId(auth.role, auth.branchId, request, body.branchId)

    // Auto-generate recordId
    const lastRecord = await db.tdsRecord.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { recordId: true },
    })
    const lastNum = lastRecord?.recordId ? parseInt(lastRecord.recordId.replace('TDS-', ''), 10) : 0
    const recordId = `TDS-${String(lastNum + 1).padStart(4, '0')}`

    const record = await db.tdsRecord.create({
      data: {
        recordId,
        panNumber: data.panNumber,
        recipientName: data.recipientName,
        amount: data.amount,
        tdsRate: data.tdsRate,
        tdsAmount: data.tdsAmount,
        section: data.section,
        quarter: data.quarter,
        fiscalYear: data.fiscalYear,
        dueDate: data.dueDate,
        challanNo: data.challanNo,
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
      module: 'tds',
      details: { recordId, recipientName: data.recipientName, amount: data.amount, section: data.section },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    })

    return NextResponse.json({ data: record }, { status: 201 })
  } catch (error) {
    console.error('[TDS_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create TDS record', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
