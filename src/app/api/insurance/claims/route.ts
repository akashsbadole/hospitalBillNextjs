import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'
import { createInsuranceClaimSchema } from '@/lib/validations'
import { generateClaimId } from '@/lib/utils'

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/insurance')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const search = searchParams.get('search')?.trim() || ''
    const patientId = searchParams.get('patientId')
    const status = searchParams.get('status')
    const insuranceCompanyId = searchParams.get('insuranceCompanyId')
    const claimType = searchParams.get('claimType')

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    const validStatuses = ['Submitted', 'Pre-Approved', 'Approved', 'Processed', 'Settled', 'Rejected']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status filter', details: `Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const validClaimTypes = ['Cashless', 'Reimbursement']
    if (claimType && !validClaimTypes.includes(claimType)) {
      return NextResponse.json(
        { error: 'Invalid claimType filter', details: `Must be one of: ${validClaimTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (patientId) where.patientId = patientId
    if (insuranceCompanyId) where.insuranceCompanyId = insuranceCompanyId
    if (claimType) where.claimType = claimType
    if (search) {
      where.OR = [
        { claimId: { contains: search } },
        { policyNumber: { contains: search } },
        { patient: { name: { contains: search } } },
        { insuranceCompany: { name: { contains: search } } },
      ]
    }

    const [claims, total] = await Promise.all([
      db.insuranceClaim.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip,
        take: limit,
        include: {
          patient: { select: { id: true, patientId: true, name: true, phone: true } },
          insuranceCompany: { select: { id: true, companyId: true, name: true, type: true } },
          invoice: { select: { id: true, invoiceNumber: true, grandTotal: true, status: true } },
        },
      }),
      db.insuranceClaim.count({ where }),
    ])

    return NextResponse.json({
      data: claims,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[INSURANCE_CLAIMS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch insurance claims', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── POST ─────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/insurance')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()

    const parsed = createInsuranceClaimSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Validate patient exists
    const patient = await db.patient.findUnique({ where: { id: data.patientId } })
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Validate insurance company exists
    const company = await db.insuranceCompany.findUnique({ where: { id: data.insuranceCompanyId } })
    if (!company) {
      return NextResponse.json({ error: 'Insurance company not found' }, { status: 404 })
    }

    // Validate invoice if provided
    if (data.invoiceId) {
      const invoice = await db.invoice.findUnique({ where: { id: data.invoiceId } })
      if (!invoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
      }
    }

    // Auto-generate claimId
    const lastClaim = await db.insuranceClaim.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { claimId: true },
    })
    const claimId = generateClaimId(lastClaim?.claimId ?? null)

    const claim = await db.insuranceClaim.create({
      data: {
        ...data,
        claimId,
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'insurance',
      details: { claimId: claim.claimId, patientId: data.patientId, insuranceCompanyId: data.insuranceCompanyId, claimType: claim.claimType },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: claim }, { status: 201 })
  } catch (error) {
    console.error('[INSURANCE_CLAIMS_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create insurance claim', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}