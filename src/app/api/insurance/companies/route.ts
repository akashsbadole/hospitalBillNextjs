import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'
import { createInsuranceCompanySchema } from '@/lib/validations'
import { generateInsuranceCompanyId } from '@/lib/utils'

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/insurance')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const search = searchParams.get('search')?.trim() || ''
    const type = searchParams.get('type')?.trim() || ''
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

    const validTypes = ['TPA', 'Government', 'Private', 'Corporate']
    if (type && !validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type filter', details: `Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (type) where.type = type
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { companyId: { contains: search } },
        { contactPerson: { contains: search } },
        { email: { contains: search } },
      ]
    }

    const [companies, total] = await Promise.all([
      db.insuranceCompany.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
        include: {
          _count: { select: { claims: true } },
        },
      }),
      db.insuranceCompany.count({ where }),
    ])

    return NextResponse.json({
      data: companies,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[INSURANCE_COMPANIES_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch insurance companies', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── POST ─────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/insurance')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  // Only Admin can create insurance companies
  if (auth.role !== 'Admin') {
    return NextResponse.json({ error: 'Only Admin can create insurance companies.' }, { status: 403 })
  }

  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()

    const parsed = createInsuranceCompanySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Auto-generate companyId
    const lastCompany = await db.insuranceCompany.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { companyId: true },
    })
    const companyId = generateInsuranceCompanyId(lastCompany?.companyId ?? null)

    const company = await db.insuranceCompany.create({
      data: {
        ...data,
        companyId,
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'insurance',
      details: { companyId: company.companyId, name: company.name, type: company.type },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: company }, { status: 201 })
  } catch (error) {
    console.error('[INSURANCE_COMPANIES_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create insurance company', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}