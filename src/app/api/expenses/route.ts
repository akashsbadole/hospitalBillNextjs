import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission, getTenantFilter, getCreateBranchId } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── Constants ─────────────────────────────────────────────────────────────
const CATEGORIES = ['Rent', 'Utilities', 'Salary', 'Equipment', 'Supplies', 'Maintenance', 'Insurance', 'Miscellaneous'] as const
const STATUSES = ['Pending', 'Approved', 'Rejected', 'Paid'] as const

// ── Schemas ──────────────────────────────────────────────────────────────
const createExpenseSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200),
  category: z.enum(CATEGORIES),
  amount: z.number().positive('Amount must be positive'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  description: z.string().trim().max(2000).optional(),
})

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/expenses')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
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
    if (category && !CATEGORIES.includes(category as typeof CATEGORIES[number])) {
      return NextResponse.json(
        { error: 'Invalid category filter', details: `Must be one of: ${CATEGORIES.join(', ')}` },
        { status: 400 }
      )
    }

    const tenantFilter = getTenantFilter(auth.role, auth.branchId, request)

    const where: Record<string, unknown> = { ...tenantFilter }
    if (status) where.status = status
    if (category) where.category = category
    if (dateFrom || dateTo) {
      where.date = {}
      if (dateFrom) (where.date as Record<string, unknown>).gte = dateFrom
      if (dateTo) (where.date as Record<string, unknown>).lte = dateTo
    }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { expenseId: { contains: search } },
      ]
    }

    const [expenses, total] = await Promise.all([
      db.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.expense.count({ where }),
    ])

    // Calculate summary
    const summary = await db.expense.aggregate({
      where: { ...tenantFilter },
      _sum: { amount: true },
      _count: true,
    })

    return NextResponse.json({
      data: expenses,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        totalAmount: summary._sum.amount || 0,
        totalCount: summary._count,
      },
    })
  } catch (error) {
    console.error('[EXPENSES_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch expenses', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── POST ─────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/expenses')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createExpenseSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data
    const createBranchId = getCreateBranchId(auth.role, auth.branchId, request, body.branchId)

    // Auto-generate expenseId
    const lastExpense = await db.expense.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { expenseId: true },
    })
    const lastNum = lastExpense?.expenseId ? parseInt(lastExpense.expenseId.replace('EXP-', ''), 10) : 0
    const expenseId = `EXP-${String(lastNum + 1).padStart(4, '0')}`

    const expense = await db.expense.create({
      data: {
        expenseId,
        title: data.title,
        category: data.category,
        amount: data.amount,
        date: data.date,
        description: data.description,
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
      module: 'expenses',
      details: { expenseId, title: data.title, amount: data.amount, category: data.category },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    })

    return NextResponse.json({ data: expense }, { status: 201 })
  } catch (error) {
    console.error('[EXPENSES_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create expense', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
