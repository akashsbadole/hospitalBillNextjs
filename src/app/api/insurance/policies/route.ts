import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generatePolicyId } from '@/lib/utils'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const policyTypes = ['Individual', 'Family Floater', 'Group', 'Corporate'] as const

const createPolicySchema = z.object({
  patientId: z.string().trim().min(1, 'Patient ID is required'),
  companyId: z.string().trim().min(1, 'Company ID is required'),
  policyNumber: z.string().trim().min(1, 'Policy number is required'),
  type: z.enum(policyTypes, { error: 'Type must be Individual, Family Floater, Group, or Corporate' }),
  coverageAmount: z.number().min(0, 'Coverage amount cannot be negative'),
  premiumAmount: z.number().min(0, 'Premium amount cannot be negative'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
  deductible: z.number().min(0).default(0),
  copayPercent: z.number().min(0).max(100).default(0),
  nomineeName: z.string().trim().optional(),
  nomineeRelation: z.string().trim().optional(),
  documents: z.string().optional(),
  notes: z.string().trim().optional(),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/insurance')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const patientId = searchParams.get('patientId')
    const companyId = searchParams.get('companyId')
    const isActive = searchParams.get('isActive')

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (patientId) where.patientId = patientId
    if (companyId) where.companyId = companyId
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true'
    }

    const [policies, total] = await Promise.all([
      db.insurancePolicy.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: { select: { id: true, patientId: true, name: true, phone: true } },
          company: { select: { id: true, companyId: true, name: true } },
        },
      }),
      db.insurancePolicy.count({ where }),
    ])

    return NextResponse.json({
      data: policies,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[INSURANCE_POLICIES_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch insurance policies', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/insurance')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()

    const parsed = createPolicySchema.safeParse(body)
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
    const company = await db.insuranceCompany.findUnique({ where: { id: data.companyId } })
    if (!company) {
      return NextResponse.json({ error: 'Insurance company not found' }, { status: 404 })
    }

    // Validate dates
    if (data.startDate >= data.endDate) {
      return NextResponse.json({ error: 'Start date must be before end date' }, { status: 400 })
    }

    // Auto-generate policyId
    const lastPolicy = await db.insurancePolicy.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { policyId: true },
    })
    const policyId = generatePolicyId(lastPolicy?.policyId ?? null)

    const policy = await db.insurancePolicy.create({
      data: {
        policyId,
        patientId: data.patientId,
        companyId: data.companyId,
        policyNumber: data.policyNumber,
        type: data.type,
        coverageAmount: data.coverageAmount,
        premiumAmount: data.premiumAmount,
        startDate: data.startDate,
        endDate: data.endDate,
        deductible: data.deductible,
        copayPercent: data.copayPercent,
        nomineeName: data.nomineeName ?? null,
        nomineeRelation: data.nomineeRelation ?? null,
        documents: data.documents ?? null,
        notes: data.notes ?? null,
      },
      include: {
        patient: { select: { id: true, patientId: true, name: true, phone: true } },
        company: { select: { id: true, companyId: true, name: true } },
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'insurance',
      details: { policyId: policy.policyId, patientId: data.patientId, companyId: data.companyId, type: data.type },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: policy }, { status: 201 })
  } catch (error) {
    console.error('[INSURANCE_POLICIES_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create insurance policy', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
