import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── Schemas ──────────────────────────────────────────────────────────────
const updateAppointmentSchema = z.object({
  patientId: z.string().trim().min(1).optional(),
  doctorId: z.string().trim().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM').optional(),
  duration: z.number().int().min(5).max(480).optional(),
  status: z.enum(['Scheduled', 'Completed', 'Cancelled', 'No-Show']).optional(),
  type: z.enum(['Consultation', 'Follow-up', 'Emergency']).optional(),
  notes: z.string().trim().optional(),
})

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/appointments')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Appointment ID is required' }, { status: 400 })
    }

    const appointment = await db.appointment.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, patientId: true, name: true, phone: true, email: true } },
        doctor: { select: { id: true, doctorId: true, name: true, specialization: true, consultationFee: true } },
      },
    })

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    return NextResponse.json({ data: appointment })
  } catch (error) {
    console.error('[APPOINTMENT_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch appointment', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── PUT ──────────────────────────────────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/appointments')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Appointment ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateAppointmentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const existing = await db.appointment.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    // If changing doctor, verify doctor exists and is active
    if (data.doctorId && data.doctorId !== existing.doctorId) {
      const doctor = await db.doctor.findUnique({ where: { id: data.doctorId } })
      if (!doctor) {
        return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
      }
      if (doctor.status !== 'Active') {
        return NextResponse.json({ error: 'Doctor is not active' }, { status: 400 })
      }
    }

    // If changing patient, verify patient exists
    if (data.patientId && data.patientId !== existing.patientId) {
      const patient = await db.patient.findUnique({ where: { id: data.patientId } })
      if (!patient) {
        return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
      }
    }

    const updated = await db.appointment.update({
      where: { id },
      data,
      include: {
        patient: { select: { id: true, patientId: true, name: true, phone: true } },
        doctor: { select: { id: true, doctorId: true, name: true, specialization: true } },
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'UPDATE',
      module: 'appointments',
      details: {
        appointmentId: id,
        patientId: updated.patient.name,
        doctorName: updated.doctor.name,
        changedFields: Object.keys(data),
        ...(data.status ? { statusChange: `${existing.status} → ${data.status}` } : {}),
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[APPOINTMENT_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update appointment', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── DELETE (soft delete → Cancelled) ────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/appointments')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'DELETE')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Appointment ID is required' }, { status: 400 })
    }

    const existing = await db.appointment.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    if (existing.status === 'Cancelled') {
      return NextResponse.json({ error: 'Appointment is already cancelled' }, { status: 400 })
    }

    if (existing.status === 'Completed') {
      return NextResponse.json({ error: 'Cannot cancel a completed appointment' }, { status: 400 })
    }

    const appointment = await db.appointment.update({
      where: { id },
      data: { status: 'Cancelled' },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'DELETE',
      module: 'appointments',
      details: { appointmentId: id, previousStatus: existing.status, date: existing.date, time: existing.time },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: appointment })
  } catch (error) {
    console.error('[APPOINTMENT_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to cancel appointment', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
