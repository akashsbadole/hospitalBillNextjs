import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const VALID_STATUSES = ['Pending', 'Approved', 'Rejected', 'Cancelled'] as const

const updateLeaveSchema = z.object({
  status: z.enum(VALID_STATUSES).optional(),
  type: z.string().trim().optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'From date must be YYYY-MM-DD').optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'To date must be YYYY-MM-DD').optional(),
  reason: z.string().trim().optional(),
  notes: z.string().trim().optional(),
})

function calculateTotalDays(fromDate: string, toDate: string): number {
  const from = new Date(fromDate)
  const to = new Date(toDate)
  const diffTime = to.getTime() - from.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1
  return Math.max(1, diffDays)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/leaves')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Leave ID is required' }, { status: 400 })
    }

    const leave = await db.leave.findUnique({
      where: { id },
      include: {
        staff: { select: { id: true, staffId: true, name: true, role: true, designation: true, department: true } },
      },
    })

    if (!leave) {
      return NextResponse.json({ error: 'Leave record not found' }, { status: 404 })
    }

    return NextResponse.json({ data: leave })
  } catch (error) {
    console.error('[LEAVE_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch leave record', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/leaves')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Leave ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateLeaveSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await db.leave.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Leave record not found' }, { status: 404 })
    }

    const data = parsed.data
    const updateData: Record<string, unknown> = {}

    if (data.type !== undefined) updateData.type = data.type
    if (data.reason !== undefined) updateData.reason = data.reason
    if (data.notes !== undefined) updateData.notes = data.notes

    if (data.fromDate !== undefined || data.toDate !== undefined) {
      const newFrom = data.fromDate ?? existing.fromDate
      const newTo = data.toDate ?? existing.toDate
      updateData.fromDate = newFrom
      updateData.toDate = newTo
      updateData.totalDays = calculateTotalDays(newFrom, newTo)
    }

    if (data.status !== undefined) {
      updateData.status = data.status

      if (data.status === 'Approved' && existing.status !== 'Approved') {
        updateData.approvedAt = new Date()
        updateData.approvedById = auth.user!.id

        const year = new Date(existing.fromDate).getFullYear()
        const balance = await db.leaveBalance.findUnique({
          where: { staffId_type_year: { staffId: existing.staffId, type: existing.type, year } },
        })

        if (balance) {
          await db.leaveBalance.update({
            where: { id: balance.id },
            data: { usedDays: balance.usedDays + existing.totalDays },
          })
        }
      }
    }

    const updated = await db.leave.update({
      where: { id },
      data: updateData,
      include: {
        staff: { select: { id: true, staffId: true, name: true, role: true, designation: true } },
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: data.status ? 'STATUS_CHANGE' : 'UPDATE',
      module: 'leaves',
      details: { leaveId: id, staffId: existing.staffId, previousStatus: existing.status, newStatus: updated.status, changedFields: Object.keys(data) },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[LEAVE_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update leave record', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/leaves')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'DELETE')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Leave ID is required' }, { status: 400 })
    }

    const existing = await db.leave.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Leave record not found' }, { status: 404 })
    }

    await db.leave.delete({ where: { id } })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'DELETE',
      module: 'leaves',
      details: { leaveId: existing.leaveId, staffId: existing.staffId, type: existing.type },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ message: 'Leave record deleted successfully' })
  } catch (error) {
    console.error('[LEAVE_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete leave record', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
