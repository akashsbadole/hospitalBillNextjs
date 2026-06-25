import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const VALID_STATUSES = ['Present', 'Absent', 'Late', 'Half-Day', 'Holiday', 'Leave', 'Weekend'] as const

const updateAttendanceSchema = z.object({
  checkIn: z.string().regex(/^\d{2}:\d{2}$/, 'Check-in must be HH:MM').optional(),
  checkOut: z.string().regex(/^\d{2}:\d{2}$/, 'Check-out must be HH:MM').optional(),
  status: z.enum(VALID_STATUSES).optional(),
  notes: z.string().trim().optional(),
})

function calculateHoursWorked(checkIn: string | null | undefined, checkOut: string | null | undefined): number {
  if (!checkIn || !checkOut) return 0
  const [inH, inM] = checkIn.split(':').map(Number)
  const [outH, outM] = checkOut.split(':').map(Number)
  const inMinutes = inH * 60 + inM
  const outMinutes = outH * 60 + outM
  const diffMinutes = outMinutes - inMinutes
  return Math.max(0, Math.round((diffMinutes / 60) * 100) / 100)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/attendance')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Attendance ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateAttendanceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await db.attendance.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 })
    }

    const data = parsed.data
    const updateData: Record<string, unknown> = {}

    if (data.checkIn !== undefined) updateData.checkIn = data.checkIn
    if (data.checkOut !== undefined) updateData.checkOut = data.checkOut
    if (data.status !== undefined) updateData.status = data.status
    if (data.notes !== undefined) updateData.notes = data.notes

    const finalCheckIn = data.checkIn !== undefined ? data.checkIn : existing.checkIn
    const finalCheckOut = data.checkOut !== undefined ? data.checkOut : existing.checkOut
    updateData.hoursWorked = calculateHoursWorked(finalCheckIn, finalCheckOut)

    const updated = await db.attendance.update({
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
      module: 'attendance' as any,
      details: { attendanceId: id, staffId: existing.staffId, date: existing.date, changedFields: Object.keys(data) },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[ATTENDANCE_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update attendance record', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/attendance')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'DELETE')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Attendance ID is required' }, { status: 400 })
    }

    const existing = await db.attendance.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 })
    }

    await db.attendance.delete({ where: { id } })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'DELETE',
      module: 'attendance' as any,
      details: { attendanceId: id, staffId: existing.staffId, date: existing.date },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ message: 'Attendance record deleted successfully' })
  } catch (error) {
    console.error('[ATTENDANCE_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete attendance record', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
