import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generateAppointmentId } from '@/lib/utils'
import { authenticateRequest, checkWritePermission, getTenantFilter, getCreateBranchId } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── Schemas ──────────────────────────────────────────────────────────────
const createAppointmentSchema = z.object({
  patientId: z.string().trim().min(1, 'Patient ID is required'),
  doctorId: z.string().trim().min(1, 'Doctor ID is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM'),
  duration: z.number().int().min(5).max(480).default(30),
  type: z.enum(['Consultation', 'Follow-up', 'Emergency']).default('Consultation'),
  notes: z.string().trim().optional(),
})

const VALID_STATUSES = ['Scheduled', 'Completed', 'Cancelled', 'No-Show'] as const
const SLOT_BUFFER_MINUTES = 15 // configurable buffer around appointments

// ── Helpers ──────────────────────────────────────────────────────────────
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

function formatTime12(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`
}

/**
 * Check if two time windows overlap, each with a ± SLOT_BUFFER_MINUTES buffer.
 * newStart/newEnd are the proposed appointment time (without buffer).
 * existingStart/existingEnd are the existing appointment time (without buffer).
 */
function timeWindowsOverlap(
  newStart: number,
  newEnd: number,
  existingStart: number,
  existingEnd: number
): boolean {
  const newWithBufferStart = newStart - SLOT_BUFFER_MINUTES
  const newWithBufferEnd = newEnd + SLOT_BUFFER_MINUTES
  const existingWithBufferStart = existingStart - SLOT_BUFFER_MINUTES
  const existingWithBufferEnd = existingEnd + SLOT_BUFFER_MINUTES
  return newWithBufferStart < existingWithBufferEnd && newWithBufferEnd > existingWithBufferStart
}

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/appointments')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const search = searchParams.get('search')?.trim() || ''
    const status = searchParams.get('status')
    const date = searchParams.get('date')
    const doctorId = searchParams.get('doctorId')
    const patientId = searchParams.get('patientId')
    const checkAvailability = searchParams.get('checkAvailability') === 'true'

    // ── Available Slots Mode ──────────────────────────────────────────
    if (checkAvailability && doctorId && date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json(
          { error: 'Invalid date format', details: 'Must be YYYY-MM-DD' },
          { status: 400 }
        )
      }

      // Verify doctor exists
      const doctor = await db.doctor.findUnique({ where: { id: doctorId } })
      if (!doctor) {
        return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
      }

      // Fetch all existing appointments for this doctor on this date
      const existingAppointments = await db.appointment.findMany({
        where: { doctorId, date, status: { not: 'Cancelled' } },
        select: { id: true, aptId: true, time: true, duration: true },
      })

      // Generate all 30-min slots from 9:00 AM to 9:00 PM (18:00–20:00 is the last 30-min slot start)
      const slots: { time: string; timeFormatted: string; available: boolean; conflicts: string[] }[] = []
      for (let minutes = 9 * 60; minutes < 21 * 60; minutes += 30) {
        const slotTime = minutesToTime(minutes)
        const slotEnd = minutes + 30

        // Check if any existing appointment overlaps this slot (with buffer)
        const conflicts: string[] = []
        for (const apt of existingAppointments) {
          const aptStart = timeToMinutes(apt.time)
          const aptEnd = aptStart + apt.duration
          if (timeWindowsOverlap(minutes, slotEnd, aptStart, aptEnd)) {
            conflicts.push(`${apt.aptId} (${apt.time}, ${apt.duration}min)`)
          }
        }

        slots.push({
          time: slotTime,
          timeFormatted: formatTime12(slotTime),
          available: conflicts.length === 0,
          conflicts,
        })
      }

      return NextResponse.json({
        data: slots,
        date,
        doctorId,
        doctorName: doctor.name,
        totalSlots: slots.length,
        availableSlots: slots.filter((s) => s.available).length,
      })
    }

    // ── Normal Paginated List Mode ─────────────────────────────────────
    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    if (status && !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      return NextResponse.json(
        { error: 'Invalid status filter', details: `Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: 'Invalid date format', details: 'Must be YYYY-MM-DD' },
        { status: 400 }
      )
    }

    const where: Record<string, unknown> = { ...getTenantFilter(auth.role, auth.branchId, request) }
    if (status) where.status = status
    if (date) where.date = date
    if (doctorId) where.doctorId = doctorId
    if (patientId) where.patientId = patientId
    if (search) {
      where.OR = [
        { patient: { name: { contains: search, mode: 'insensitive' } } },
        { doctor: { name: { contains: search, mode: 'insensitive' } } },
        { aptId: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [appointments, total] = await Promise.all([
      db.appointment.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ date: 'desc' }, { time: 'desc' }],
        include: {
          patient: { select: { id: true, patientId: true, name: true, phone: true } },
          doctor: { select: { id: true, doctorId: true, name: true, specialization: true } },
        },
      }),
      db.appointment.count({ where }),
    ])

    return NextResponse.json({
      data: appointments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[APPOINTMENTS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch appointments', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── POST ─────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/appointments')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()

    const parsed = createAppointmentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Check patient and doctor exist
    const [patient, doctor] = await Promise.all([
      db.patient.findUnique({ where: { id: data.patientId } }),
      db.doctor.findUnique({ where: { id: data.doctorId } }),
    ])

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }
    if (!doctor) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }
    if (doctor.status !== 'Active') {
      return NextResponse.json({ error: 'Doctor is not active' }, { status: 400 })
    }

    // ── Slot Conflict Detection ───────────────────────────────────────
    const newStart = timeToMinutes(data.time)
    const newEnd = newStart + data.duration

    const conflictingAppointments = await db.appointment.findMany({
      where: {
        doctorId: data.doctorId,
        date: data.date,
        status: { not: 'Cancelled' },
      },
      include: {
        doctor: { select: { name: true } },
      },
    })

    for (const existing of conflictingAppointments) {
      const existingStart = timeToMinutes(existing.time)
      const existingEnd = existingStart + existing.duration

      if (timeWindowsOverlap(newStart, newEnd, existingStart, existingEnd)) {
        return NextResponse.json(
          {
            error: `Time slot conflicts with existing appointment ${existing.aptId} for Dr. ${existing.doctor.name} at ${formatTime12(existing.time)}`,
            conflict: {
              aptId: existing.aptId,
              doctorName: existing.doctor.name,
              time: existing.time,
              duration: existing.duration,
              status: existing.status,
            },
          },
          { status: 400 }
        )
      }
    }

    // Auto-generate appointment ID
    const lastApt = await db.appointment.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { aptId: true },
    })
    const aptId = generateAppointmentId(lastApt?.aptId ?? null)

    const createBranchId = getCreateBranchId(auth.role, auth.branchId, request, body.branchId)
    const appointment = await db.appointment.create({
      data: {
        ...data,
        aptId,
        branchId: createBranchId,
      },
      include: {
        patient: { select: { id: true, patientId: true, name: true, phone: true } },
        doctor: { select: { id: true, doctorId: true, name: true, specialization: true } },
      },
    })

    logAudit({
      userId: auth.userId!,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'appointments',
      details: { aptId: appointment.aptId, date: appointment.date, time: appointment.time },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: appointment }, { status: 201 })
  } catch (error) {
    console.error('[APPOINTMENTS_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create appointment', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
