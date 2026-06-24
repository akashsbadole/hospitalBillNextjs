import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'
import { updateInsuranceClaimSchema } from '@/lib/validations'

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
      return NextResponse.json({ error: 'Claim ID is required' }, { status: 400 })
    }

    const claim = await db.insuranceClaim.findUnique({
      where: { id },
      include: {
        patient: {
          select: { id: true, patientId: true, name: true, phone: true, email: true, address: true, city: true, state: true },
        },
        insuranceCompany: {
          select: { id: true, companyId: true, name: true, type: true, contactPerson: true, phone: true, email: true, address: true, gstin: true },
        },
        invoice: {
          select: { id: true, invoiceNumber: true, date: true, subtotal: true, totalGst: true, grandTotal: true, paidAmount: true, status: true },
        },
      },
    })

    if (!claim) {
      return NextResponse.json({ error: 'Insurance claim not found' }, { status: 404 })
    }

    return NextResponse.json({ data: claim })
  } catch (error) {
    console.error('[INSURANCE_CLAIM_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch insurance claim', details: error instanceof Error ? error.message : 'Unknown error' },
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
      return NextResponse.json({ error: 'Claim ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateInsuranceClaimSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const existing = await db.insuranceClaim.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Insurance claim not found' }, { status: 404 })
    }

    // Build update data with timestamp logic
    const updateData: Record<string, unknown> = { ...data }

    // Set approvedAt when status changes to Approved or beyond
    if (data.status && ['Approved', 'Processed', 'Settled'].includes(data.status) && !existing.approvedAt) {
      updateData.approvedAt = new Date()
    }

    // Set settledAt when status is Settled
    if (data.status === 'Settled' && !existing.settledAt) {
      updateData.settledAt = new Date()
    }

    // When settling, ensure settledAmount is set
    if (data.status === 'Settled' && data.settledAmount === undefined) {
      updateData.settledAmount = data.approvedAmount ?? existing.approvedAmount ?? 0
    }

    const updated = await db.insuranceClaim.update({
      where: { id },
      data: updateData,
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: existing.status !== updated.status ? 'STATUS_CHANGE' : 'UPDATE',
      module: 'insurance',
      details: {
        claimId: id,
        previousStatus: existing.status,
        newStatus: updated.status,
        approvedAmount: updated.approvedAmount,
        settledAmount: updated.settledAmount,
        changedFields: Object.keys(data),
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[INSURANCE_CLAIM_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update insurance claim', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}