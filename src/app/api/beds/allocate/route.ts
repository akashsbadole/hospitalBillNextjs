import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const allocateSchema = z.object({
  patientId: z.string().min(1, 'Patient ID is required'),
  visitId: z.string().min(1, 'Visit ID is required'),
  bedId: z.string().min(1, 'Bed ID is required'),
})

// ── POST: allocate bed to patient ────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/beds')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = allocateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { patientId, visitId, bedId } = parsed.data

    // Validate bed is available
    const bed = await db.bed.findUnique({ where: { id: bedId } })
    if (!bed) {
      return NextResponse.json({ error: 'Bed not found' }, { status: 404 })
    }
    if (bed.status !== 'Available') {
      return NextResponse.json(
        { error: 'Bed is not available', details: `Current status: ${bed.status}` },
        { status: 400 }
      )
    }

    // Validate patient exists
    const patient = await db.patient.findUnique({ where: { id: patientId } })
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Validate visit exists, is active IPD, and belongs to patient
    const visit = await db.patientVisit.findFirst({
      where: {
        id: visitId,
        patientId,
        visitType: 'IPD',
        status: 'Active',
      },
    })
    if (!visit) {
      return NextResponse.json(
        { error: 'No active IPD visit found for this patient' },
        { status: 400 }
      )
    }

    // Allocate the bed
    const updatedBed = await db.bed.update({
      where: { id: bedId },
      data: {
        status: 'Occupied',
        currentPatientId: patientId,
        currentVisitId: visitId,
        admittedAt: new Date(),
      },
      include: {
        ward: { select: { id: true, wardId: true, name: true, floor: true } },
        currentPatient: { select: { id: true, patientId: true, name: true } },
        currentVisit: { select: { id: true, visitId: true } },
      },
    })

    // Update the visit with room/bed number
    await db.patientVisit.update({
      where: { id: visitId },
      data: {
        roomNumber: `${bed.wardId ? '' : ''}${bed.bedNumber}`,
        admissionDate: new Date().toISOString().split('T')[0],
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'beds',
      details: {
        bedId: bed.bedId,
        bedNumber: bed.bedNumber,
        patientId: patient.patientId,
        patientName: patient.name,
        visitId: visit.visitId,
        action: 'allocated',
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: updatedBed })
  } catch (error) {
    console.error('[BED_ALLOCATE]', error)
    return NextResponse.json(
      { error: 'Failed to allocate bed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}