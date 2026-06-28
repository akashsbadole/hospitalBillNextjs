import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const updateShiftSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be HH:MM').optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'End time must be HH:MM').optional(),
  daysOfWeek: z.string().trim().optional(),
  gracePeriod: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  branchId: z.string().trim().optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/shifts')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Shift ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateShiftSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await db.shift.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    }

    const data = parsed.data
    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.startTime !== undefined) updateData.startTime = data.startTime
    if (data.endTime !== undefined) updateData.endTime = data.endTime
    if (data.daysOfWeek !== undefined) updateData.daysOfWeek = data.daysOfWeek
    if (data.gracePeriod !== undefined) updateData.gracePeriod = data.gracePeriod
    if (data.isActive !== undefined) updateData.isActive = data.isActive
    if (data.branchId !== undefined) updateData.branchId = data.branchId || null

    const updated = await db.shift.update({
      where: { id },
      data: updateData,
      include: {
        branch: { select: { id: true, branchId: true, name: true, code: true } },
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'UPDATE',
      module: 'shifts',
      details: { shiftId: id, name: updated.name, changedFields: Object.keys(data) },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[SHIFTS_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update shift', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/shifts')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'DELETE')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Shift ID is required' }, { status: 400 })
    }

    const existing = await db.shift.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    }

    await db.shift.delete({ where: { id } })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'DELETE',
      module: 'shifts',
      details: { shiftId: existing.shiftId, name: existing.name },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ message: 'Shift deleted successfully' })
  } catch (error) {
    console.error('[SHIFTS_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete shift', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
