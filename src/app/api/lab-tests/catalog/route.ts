import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'
import { createLabTestCatalogSchema } from '@/lib/validations'
import { generateLabTestId } from '@/lib/utils'

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/lab-tests')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const search = searchParams.get('search')?.trim() || ''
    const category = searchParams.get('category')?.trim() || ''
    const status = searchParams.get('status')

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    const validStatuses = ['Active', 'Inactive']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status filter', details: `Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const validCategories = ['Hematology', 'Biochemistry', 'Microbiology', 'Radiology', 'Pathology']
    if (category && !validCategories.includes(category)) {
      return NextResponse.json(
        { error: 'Invalid category filter', details: `Must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      )
    }

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (category) where.category = category
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { testId: { contains: search } },
        { description: { contains: search } },
      ]
    }

    const [tests, total] = await Promise.all([
      db.labTestCatalog.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
        include: {
          _count: { select: { orders: true } },
        },
      }),
      db.labTestCatalog.count({ where }),
    ])

    return NextResponse.json({
      data: tests,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[LAB_TESTS_CATALOG_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch lab test catalog', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── POST ─────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/lab-tests')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  // Only Admin can create lab test catalog entries
  if (auth.role !== 'Admin') {
    return NextResponse.json({ error: 'Only Admin can create lab test catalog entries.' }, { status: 403 })
  }

  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()

    const parsed = createLabTestCatalogSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Auto-generate testId
    const lastTest = await db.labTestCatalog.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { testId: true },
    })
    const testId = generateLabTestId(lastTest?.testId ?? null)

    const test = await db.labTestCatalog.create({
      data: {
        ...data,
        testId,
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'lab-tests',
      details: { testId: test.testId, name: test.name, category: test.category },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: test }, { status: 201 })
  } catch (error) {
    console.error('[LAB_TESTS_CATALOG_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create lab test', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}