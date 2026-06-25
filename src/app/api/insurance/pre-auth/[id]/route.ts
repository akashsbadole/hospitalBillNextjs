import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const validStatuses = ['Pending', 'Approved', 'Partially-Approved', 'Rejected'] as const

const updatePreAuthSchema = z.object({
  status: z.enum(validStatuses).optional(),
  approvedAmount: z.number().min(0).optional(),
  authorizedBy: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
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
      return NextResponse.json({ error: 'Pre-auth ID is required' }, { status: 400 })
    }

    const approval = await db.preAuthApproval.findUnique({
      where: { id },
      include: {
        claim: { select: { id: true, claimId: true, policyNumber: true, status: true } },
        policy: { select: { id: true, policyId: true, policyNumber: true, type: true, coverageAmount: true } },
      },
    })

    if (!approval) {
      return NextResponse.json({ error: 'Pre-auth approval not found' }, { status: 404 })
    }

    return NextResponse.json({ data: approval })
  } catch (error) {
    console.error('[PRE_AUTH_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch pre-auth approval', details: error instanceof Error ? error.message : 'Unknown error' },
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
      return NextResponse.json({ error: 'Pre-auth ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updatePreAuthSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const existing = await db.preAuthApproval.findUnique({
      where: { id },
      include: { claim: { select: { id: true, status: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Pre-auth approval not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = { ...data }

    // Set authorizedDate to now if status is changing to Approved or Partially-Approved
    if (data.status && ['Approved', 'Partially-Approved'].includes(data.status)) {
      updateData.authorizedDate = new Date()
    }

    const updated = await db.preAuthApproval.update({
      where: { id },
      data: updateData,
      include: {
        claim: { select: { id: true, claimId: true, policyNumber: true, status: true } },
        policy: { select: { id: true, policyId: true, policyNumber: true } },
      },
    })

    // If approved, update the parent claim's status to "Pre-Approved"
    if (data.status === 'Approved' && existing.claim.status !== 'Pre-Approved') {
      await db.insuranceClaim.update({
        where: { id: existing.claim.id },
        data: { status: 'Pre-Approved' },
      })
    }

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: existing.status !== updated.status ? 'STATUS_CHANGE' : 'UPDATE',
      module: 'insurance',
      details: {
        preAuthId: id,
        previousStatus: existing.status,
        newStatus: updated.status,
        approvedAmount: updated.approvedAmount,
        changedFields: Object.keys(data),
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[PRE_AUTH_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update pre-auth approval', details: error instanceof Error ? error.message : 'Unknown error' },
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
      return NextResponse.json({ error: 'Pre-auth ID is required' }, { status: 400 })
    }

    const existing = await db.preAuthApproval.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Pre-auth approval not found' }, { status: 404 })
    }

    await db.preAuthApproval.delete({ where: { id } })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'DELETE',
      module: 'insurance',
      details: { preAuthId: id, claimId: existing.claimId },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: { id }, message: 'Pre-auth approval deleted successfully' })
  } catch (error) {
    console.error('[PRE_AUTH_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete pre-auth approval', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
