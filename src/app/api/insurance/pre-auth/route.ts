import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generatePreAuthId } from '@/lib/utils'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const createPreAuthSchema = z.object({
  claimId: z.string().trim().min(1, 'Claim ID is required'),
  policyId: z.string().trim().min(1, 'Policy ID is required'),
  requestAmount: z.number().min(0, 'Request amount cannot be negative'),
  approvedAmount: z.number().min(0).default(0),
  authorizedBy: z.string().trim().optional(),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid until must be YYYY-MM-DD').optional(),
  remarks: z.string().trim().optional(),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/insurance')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const claimId = searchParams.get('claimId')
    const policyId = searchParams.get('policyId')
    const status = searchParams.get('status')

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    const validStatuses = ['Pending', 'Approved', 'Partially-Approved', 'Rejected']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status filter', details: `Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const where: Record<string, unknown> = {}
    if (claimId) where.claimId = claimId
    if (policyId) where.policyId = policyId
    if (status) where.status = status

    const [approvals, total] = await Promise.all([
      db.preAuthApproval.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          claim: { select: { id: true, claimId: true, policyNumber: true, status: true } },
          policy: { select: { id: true, policyId: true, policyNumber: true } },
        },
      }),
      db.preAuthApproval.count({ where }),
    ])

    return NextResponse.json({
      data: approvals,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[PRE_AUTH_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch pre-auth approvals', details: error instanceof Error ? error.message : 'Unknown error' },
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

    const parsed = createPreAuthSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Validate claim exists
    const claim = await db.insuranceClaim.findUnique({ where: { id: data.claimId } })
    if (!claim) {
      return NextResponse.json({ error: 'Insurance claim not found' }, { status: 404 })
    }

    // Validate policy exists
    const policy = await db.insurancePolicy.findUnique({ where: { id: data.policyId } })
    if (!policy) {
      return NextResponse.json({ error: 'Insurance policy not found' }, { status: 404 })
    }

    // Auto-generate preAuthId
    const lastPreAuth = await db.preAuthApproval.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { preAuthId: true },
    })
    const preAuthId = generatePreAuthId(lastPreAuth?.preAuthId ?? null)

    const approval = await db.preAuthApproval.create({
      data: {
        preAuthId,
        claimId: data.claimId,
        policyId: data.policyId,
        requestAmount: data.requestAmount,
        approvedAmount: data.approvedAmount,
        authorizedBy: data.authorizedBy ?? null,
        validUntil: data.validUntil ?? null,
        remarks: data.remarks ?? null,
      },
      include: {
        claim: { select: { id: true, claimId: true, policyNumber: true, status: true } },
        policy: { select: { id: true, policyId: true, policyNumber: true } },
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'insurance',
      details: { preAuthId: approval.preAuthId, claimId: data.claimId, policyId: data.policyId, requestAmount: data.requestAmount },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: approval }, { status: 201 })
  } catch (error) {
    console.error('[PRE_AUTH_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create pre-auth approval', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
