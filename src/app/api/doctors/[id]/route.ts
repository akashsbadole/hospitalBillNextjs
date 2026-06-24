import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── Schemas ──────────────────────────────────────────────────────────────
const updateDoctorSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200).optional(),
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().trim().min(1, 'Phone is required').max(20).optional(),
  specialization: z.string().trim().min(1).max(200).optional(),
  qualification: z.string().trim().optional(),
  experience: z.number().int().min(0).max(80).optional(),
  consultationFee: z.number().min(0).optional(),
  bio: z.string().trim().optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
})

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/doctors')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Doctor ID is required' }, { status: 400 })
    }

    const doctor = await db.doctor.findUnique({
      where: { id },
      include: {
        _count: { select: { appointments: true } },
      },
    })

    if (!doctor) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }

    // Calculate revenue from completed appointments' invoices
    const completedAppointments = await db.appointment.findMany({
      where: { doctorId: id, status: 'Completed' },
      include: { patient: { include: { invoices: { where: { status: { not: 'Cancelled' } } } } } },
    })

    const revenue = completedAppointments.reduce((sum, apt) => {
      return sum + apt.patient.invoices.reduce((invoiceSum, inv) => invoiceSum + inv.grandTotal, 0)
    }, 0)

    return NextResponse.json({ data: { ...doctor, revenue } })
  } catch (error) {
    console.error('[DOCTOR_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch doctor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── PUT ──────────────────────────────────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/doctors')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Doctor ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateDoctorSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const existing = await db.doctor.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }

    const updated = await db.doctor.update({
      where: { id },
      data: {
        ...data,
        email: data.email === '' ? null : data.email,
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'UPDATE',
      module: 'doctors',
      details: { doctorId: id, name: updated.name, changedFields: Object.keys(data) },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[DOCTOR_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update doctor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── DELETE (soft delete) ────────────────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/doctors')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'DELETE')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Doctor ID is required' }, { status: 400 })
    }

    const existing = await db.doctor.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }

    if (existing.status === 'Inactive') {
      return NextResponse.json({ error: 'Doctor is already inactive' }, { status: 400 })
    }

    const doctor = await db.doctor.update({
      where: { id },
      data: { status: 'Inactive' },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'DELETE',
      module: 'doctors',
      details: { doctorId: id, name: doctor.name, doctorIdDisplay: existing.doctorId },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: doctor })
  } catch (error) {
    console.error('[DOCTOR_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to deactivate doctor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
