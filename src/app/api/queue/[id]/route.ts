import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const updateTokenSchema = z.object({
  status: z.enum(['Waiting', 'Called', 'In-Consultation', 'Completed', 'Skipped']).optional(),
  priority: z.enum(['Normal', 'Urgent', 'Emergency', 'VIP']).optional(),
  counterNumber: z.string().optional(),
  department: z.string().optional(),
})

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  Waiting: ['Called', 'Skipped', 'Completed'],
  Called: ['In-Consultation', 'Waiting', 'Completed', 'Skipped'],
  'In-Consultation': ['Completed'],
  Completed: [],
  Skipped: ['Waiting', 'Called'],
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/queue')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Token ID is required' }, { status: 400 })
    }

    const token = await db.queueToken.findUnique({
      where: { id },
      include: {
        patient: {
          select: { id: true, patientId: true, name: true, phone: true, gender: true, bloodGroup: true, email: true },
        },
        visit: {
          select: { id: true, visitId: true, stage: true, status: true },
        },
      },
    })

    if (!token) {
      return NextResponse.json({ error: 'Queue token not found' }, { status: 404 })
    }

    return NextResponse.json({ data: token })
  } catch (error) {
    console.error('[QUEUE_TOKEN_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch token', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/queue')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Token ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateTokenSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const existing = await db.queueToken.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Queue token not found' }, { status: 404 })
    }

    if (data.status) {
      const allowedTransitions = VALID_STATUS_TRANSITIONS[existing.status]
      if (!allowedTransitions.includes(data.status)) {
        return NextResponse.json(
          {
            error: 'Invalid status transition',
            details: `Cannot transition from '${existing.status}' to '${data.status}'. Allowed: ${allowedTransitions.join(', ') || 'none'}`,
          },
          { status: 400 }
        )
      }
    }

    const updateData: Record<string, unknown> = {}
    if (data.status) updateData.status = data.status
    if (data.priority) updateData.priority = data.priority
    if (data.counterNumber !== undefined) updateData.counterNumber = data.counterNumber
    if (data.department) updateData.department = data.department

    if (data.status === 'Called' && !existing.calledAt) {
      updateData.calledAt = new Date()
      updateData.callCount = (existing.callCount || 0) + 1
    }

    if (data.status === 'Completed') {
      updateData.completedAt = new Date()
    }

    const token = await db.queueToken.update({
      where: { id },
      data: updateData,
      include: {
        patient: {
          select: { id: true, patientId: true, name: true, phone: true },
        },
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'UPDATE',
      module: 'queue',
      details: { tokenId: token.tokenId, status: data.status || existing.status, changedFields: Object.keys(data) },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: token })
  } catch (error) {
    console.error('[QUEUE_TOKEN_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update token', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/queue')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'DELETE')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Token ID is required' }, { status: 400 })
    }

    const existing = await db.queueToken.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Queue token not found' }, { status: 404 })
    }

    if (existing.status === 'In-Consultation') {
      return NextResponse.json(
        { error: 'Cannot delete a token that is In-Consultation. Complete it first.' },
        { status: 400 }
      )
    }

    await db.queueToken.delete({ where: { id } })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'DELETE',
      module: 'queue',
      details: { tokenId: existing.tokenId, tokenNumber: existing.tokenNumber, department: existing.department },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: { id, deleted: true } })
  } catch (error) {
    console.error('[QUEUE_TOKEN_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete token', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
