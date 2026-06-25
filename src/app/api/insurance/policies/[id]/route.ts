import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const updatePolicySchema = z.object({
  policyNumber: z.string().trim().min(1).optional(),
  type: z.enum(['Individual', 'Family Floater', 'Group', 'Corporate']).optional(),
  coverageAmount: z.number().min(0).optional(),
  premiumAmount: z.number().min(0).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD').optional(),
  deductible: z.number().min(0).optional(),
  copayPercent: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
  nomineeName: z.string().trim().optional(),
  nomineeRelation: z.string().trim().optional(),
  documents: z.string().optional(),
  notes: z.string().trim().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/insurance')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Policy ID is required' }, { status: 400 })
    }

    const policy = await db.insurancePolicy.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, patientId: true, name: true, phone: true, email: true } },
        company: { select: { id: true, companyId: true, name: true, type: true, phone: true, email: true } },
        preAuthApprovals: {
          orderBy: { createdAt: 'desc' },
          include: {
            claim: { select: { id: true, claimId: true, status: true } },
          },
        },
      },
    })

    if (!policy) {
      return NextResponse.json({ error: 'Insurance policy not found' }, { status: 404 })
    }

    return NextResponse.json({ data: policy })
  } catch (error) {
    console.error('[INSURANCE_POLICY_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch insurance policy', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/insurance')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Policy ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updatePolicySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const existing = await db.insurancePolicy.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Insurance policy not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = { ...data }

    const updated = await db.insurancePolicy.update({
      where: { id },
      data: updateData,
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
      action: 'UPDATE',
      module: 'insurance',
      details: { policyId: id, changedFields: Object.keys(data) },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[INSURANCE_POLICY_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update insurance policy', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/insurance')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'DELETE')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Policy ID is required' }, { status: 400 })
    }

    const existing = await db.insurancePolicy.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Insurance policy not found' }, { status: 404 })
    }

    // Check for active pre-auth approvals
    const activePreAuths = await db.preAuthApproval.count({
      where: { policyId: id, status: { in: ['Pending', 'Approved', 'Partially-Approved'] } },
    })
    if (activePreAuths > 0) {
      return NextResponse.json(
        { error: 'Cannot delete policy with active pre-auth approvals', details: `${activePreAuths} active pre-auth approval(s) exist` },
        { status: 400 }
      )
    }

    await db.insurancePolicy.delete({ where: { id } })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'DELETE',
      module: 'insurance',
      details: { policyId: id, policyNumber: existing.policyNumber },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: { id }, message: 'Policy deleted successfully' })
  } catch (error) {
    console.error('[INSURANCE_POLICY_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete insurance policy', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
