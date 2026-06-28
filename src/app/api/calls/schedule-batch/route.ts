import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── Constants ──────────────────────────────────────────────────────────────
const VALID_CALL_TYPES = ['Video', 'Audio', 'Chat'] as const

// ── Schema ──────────────────────────────────────────────────────────────
const batchCallSchema = z.object({
  calls: z.array(
    z.object({
      appointmentId: z.string().trim().optional(),
      patientId: z.string().trim().min(1, 'Patient ID is required'),
      doctorId: z.string().trim().min(1, 'Doctor ID is required'),
      callType: z.enum(VALID_CALL_TYPES).default('Video'),
      scheduledAt: z.string().min(1, 'Scheduled date/time is required'),
      notes: z.string().trim().optional(),
    })
  ).min(1, 'At least one call is required').max(50, 'Maximum 50 calls per batch'),
})

// ── POST — Schedule batch of calls ──────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/calls')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = batchCallSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const callsToCreate = parsed.data.calls

    // Validate all patient and doctor IDs exist
    const patientIds = [...new Set(callsToCreate.map(c => c.patientId))]
    const doctorIds = [...new Set(callsToCreate.map(c => c.doctorId))]
    const appointmentIds = [...new Set(callsToCreate.map(c => c.appointmentId).filter(Boolean))] as string[]

    const [patients, doctors] = await Promise.all([
      db.patient.findMany({ where: { id: { in: patientIds } }, select: { id: true } }),
      db.doctor.findMany({ where: { id: { in: doctorIds } }, select: { id: true, status: true } }),
    ])

    const patientIdSet = new Set(patients.map(p => p.id))
    const doctorIdSet = new Set(doctors.map(d => d.id))
    const inactiveDoctorIds = new Set(doctors.filter(d => d.status !== 'Active').map(d => d.id))

    // Check for missing patients
    const missingPatients = patientIds.filter(id => !patientIdSet.has(id))
    if (missingPatients.length > 0) {
      return NextResponse.json(
        { error: 'Some patients not found', details: { missingPatientIds: missingPatients } },
        { status: 404 }
      )
    }

    // Check for missing doctors
    const missingDoctors = doctorIds.filter(id => !doctorIdSet.has(id))
    if (missingDoctors.length > 0) {
      return NextResponse.json(
        { error: 'Some doctors not found', details: { missingDoctorIds: missingDoctors } },
        { status: 404 }
      )
    }

    // Check for inactive doctors
    const callsWithInactiveDoctor = callsToCreate.filter(c => inactiveDoctorIds.has(c.doctorId))
    if (callsWithInactiveDoctor.length > 0) {
      return NextResponse.json(
        { error: 'Some doctors are not active', details: { inactiveDoctorIds: [...inactiveDoctorIds] } },
        { status: 400 }
      )
    }

    // Validate appointments if provided
    if (appointmentIds.length > 0) {
      const appointments = await db.appointment.findMany({
        where: { id: { in: appointmentIds } },
        select: { id: true, patientId: true, doctorId: true },
      })
      const appointmentMap = new Map(appointments.map(a => [a.id, a]))

      const invalidAppointments = callsToCreate.filter(
        c => c.appointmentId && (
          !appointmentMap.has(c.appointmentId) ||
          appointmentMap.get(c.appointmentId)!.patientId !== c.patientId ||
          appointmentMap.get(c.appointmentId)!.doctorId !== c.doctorId
        )
      )
      if (invalidAppointments.length > 0) {
        return NextResponse.json(
          { error: 'Some appointments are invalid or do not belong to the specified patient/doctor' },
          { status: 400 }
        )
      }
    }

    // Get the last session ID for sequential numbering
    const lastCall = await db.callSession.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { sessionId: true },
    })
    let lastNumber = lastCall?.sessionId
      ? parseInt(lastCall.sessionId.replace('CALL-', ''), 10)
      : 0

    // Create all calls in a transaction
    const createdCalls = await db.$transaction(
      callsToCreate.map((callData) => {
        lastNumber++
        const sessionId = `CALL-${String(lastNumber).padStart(4, '0')}`

        return db.callSession.create({
          data: {
            sessionId,
            appointmentId: callData.appointmentId ?? null,
            patientId: callData.patientId,
            doctorId: callData.doctorId,
            callType: callData.callType,
            scheduledAt: callData.scheduledAt,
            notes: callData.notes ?? null,
            status: 'Scheduled',
          },
          include: {
            patient: { select: { id: true, patientId: true, name: true, phone: true } },
            doctor: { select: { id: true, doctorId: true, name: true, specialization: true } },
            visit: { select: { id: true, visitId: true } },
          },
        })
      })
    )

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'calls',
      details: {
        action: 'batch_schedule',
        count: createdCalls.length,
        sessionIds: createdCalls.map(c => c.sessionId),
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: createdCalls, count: createdCalls.length }, { status: 201 })
  } catch (error) {
    console.error('[CALLS_BATCH_POST]', error)
    return NextResponse.json(
      { error: 'Failed to schedule batch calls', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
