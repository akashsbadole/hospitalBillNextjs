import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const VALID_TYPES = ['Annual', 'Sick', 'Casual', 'Maternity', 'Paternity'] as const

const updateLeaveBalanceSchema = z.object({
  totalDays: z.number().min(0).optional(),
  usedDays: z.number().min(0).optional(),
  type: z.enum(VALID_TYPES).optional(),
  year: z.number().int().min(2020).max(2100).optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/leave-balance')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Leave balance ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateLeaveBalanceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await db.leaveBalance.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Leave balance not found' }, { status: 404 })
    }

    const data = parsed.data
    const updateData: Record<string, unknown> = {}

    if (data.totalDays !== undefined) updateData.totalDays = data.totalDays
    if (data.usedDays !== undefined) updateData.usedDays = data.usedDays
    if (data.type !== undefined) updateData.type = data.type
    if (data.year !== undefined) updateData.year = data.year

    const updated = await db.leaveBalance.update({
      where: { id },
      data: updateData,
      include: {
        staff: { select: { id: true, staffId: true, name: true, role: true } },
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'UPDATE',
      module: 'leave-balance',
      details: { balanceId: id, staffId: existing.staffId, type: existing.type, year: existing.year, changedFields: Object.keys(data) },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[LEAVE_BALANCE_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update leave balance', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
