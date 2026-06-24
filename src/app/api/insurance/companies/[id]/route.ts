import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'
import { updateInsuranceCompanySchema } from '@/lib/validations'

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/insurance')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 })
    }

    const company = await db.insuranceCompany.findUnique({
      where: { id },
      include: {
        _count: { select: { claims: true } },
      },
    })

    if (!company) {
      return NextResponse.json({ error: 'Insurance company not found' }, { status: 404 })
    }

    // Include claims summary
    const claimsSummary = await db.insuranceClaim.groupBy({
      by: ['status'],
      where: { insuranceCompanyId: id },
      _count: { id: true },
      _sum: { approvedAmount: true, settledAmount: true },
    })

    const summary = claimsSummary.reduce<Record<string, { count: number; approvedAmount: number; settledAmount: number }>>((acc, s) => {
      acc[s.status] = {
        count: s._count.id,
        approvedAmount: s._sum.approvedAmount ?? 0,
        settledAmount: s._sum.settledAmount ?? 0,
      }
      return acc
    }, {})

    return NextResponse.json({ data: { ...company, claimsSummary: summary } })
  } catch (error) {
    console.error('[INSURANCE_COMPANY_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch insurance company', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── PUT ──────────────────────────────────────────────────────────────────
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
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateInsuranceCompanySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const existing = await db.insuranceCompany.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Insurance company not found' }, { status: 404 })
    }

    const updated = await db.insuranceCompany.update({
      where: { id },
      data,
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'UPDATE',
      module: 'insurance',
      details: { companyId: id, name: updated.name, changedFields: Object.keys(data) },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[INSURANCE_COMPANY_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update insurance company', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── DELETE (soft delete → Inactive) ─────────────────────────────────────
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
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 })
    }

    const existing = await db.insuranceCompany.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Insurance company not found' }, { status: 404 })
    }

    if (existing.status === 'Inactive') {
      return NextResponse.json({ error: 'Insurance company is already inactive' }, { status: 400 })
    }

    // Check for active claims
    const activeClaims = await db.insuranceClaim.count({
      where: { insuranceCompanyId: id, status: { notIn: ['Settled', 'Rejected'] } },
    })
    if (activeClaims > 0) {
      return NextResponse.json(
        { error: 'Cannot deactivate company with active claims', details: `${activeClaims} active claim(s) exist` },
        { status: 400 }
      )
    }

    const company = await db.insuranceCompany.update({
      where: { id },
      data: { status: 'Inactive' },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'DELETE',
      module: 'insurance',
      details: { companyId: id, name: company.name },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: company })
  } catch (error) {
    console.error('[INSURANCE_COMPANY_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to deactivate insurance company', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}