import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const updateBedSchema = z.object({
  bedNumber: z.string().trim().min(1).max(20).optional(),
  bedType: z.enum(['Standard', 'Deluxe', 'Suite', 'ICU Bed', 'Emergency']).optional(),
  dailyRate: z.number().min(0).optional(),
  status: z.enum(['Available', 'Occupied', 'Maintenance', 'Reserved']).optional(),
  // For direct patient assignment via PUT (alternative to /allocate)
  currentPatientId: z.string().nullable().optional(),
  currentVisitId: z.string().nullable().optional(),
})

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/beds')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Bed ID is required' }, { status: 400 })
    }

    const bed = await db.bed.findUnique({
      where: { id },
      include: {
        ward: { select: { id: true, wardId: true, name: true, floor: true, status: true } },
        currentPatient: { select: { id: true, patientId: true, name: true, phone: true, email: true } },
        currentVisit: {
          select: { id: true, visitId: true, visitType: true, stage: true, status: true, admissionDate: true },
        },
      },
    })

    if (!bed) {
      return NextResponse.json({ error: 'Bed not found' }, { status: 404 })
    }

    return NextResponse.json({ data: bed })
  } catch (error) {
    console.error('[BED_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch bed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── PUT ──────────────────────────────────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/beds')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Bed ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateBedSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await db.bed.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Bed not found' }, { status: 404 })
    }

    const data: Record<string, unknown> = { ...parsed.data }

    // Handle patient assignment via PUT
    if (parsed.data.currentPatientId && parsed.data.currentPatientId !== null) {
      if (existing.status !== 'Available') {
        return NextResponse.json({ error: 'Bed is not available for assignment', details: `Current status: ${existing.status}` }, { status: 400 })
      }

      // Validate patient has an active IPD visit
      const activeVisit = await db.patientVisit.findFirst({
        where: {
          patientId: parsed.data.currentPatientId,
          visitType: 'IPD',
          status: 'Active',
        },
      })

      if (!activeVisit) {
        return NextResponse.json(
          { error: 'No active IPD visit found for this patient' },
          { status: 400 }
        )
      }

      // Use the active visit if not explicitly provided
      if (!parsed.data.currentVisitId) {
        data.currentVisitId = activeVisit.id
      } else {
        // Validate provided visitId belongs to the patient and is active IPD
        const visit = await db.patientVisit.findFirst({
          where: {
            id: parsed.data.currentVisitId,
            patientId: parsed.data.currentPatientId,
            visitType: 'IPD',
            status: 'Active',
          },
        })
        if (!visit) {
          return NextResponse.json(
            { error: 'Invalid visit: must be an active IPD visit for this patient' },
            { status: 400 }
          )
        }
      }

      data.status = 'Occupied'
      data.admittedAt = new Date()

      // Update visit roomNumber
      const visitIdForUpdate = (data.currentVisitId as string) || (parsed.data.currentPatientId as string)
      await db.patientVisit.update({
        where: { id: visitIdForUpdate },
        data: { roomNumber: existing.bedNumber },
      })
    }

    // Handle releasing patient via PUT (setting patientId to null)
    if (parsed.data.currentPatientId === null) {
      if (existing.currentPatientId) {
        // Calculate bed days
        const admittedAt = existing.admittedAt
        let bedDays = 0
        if (admittedAt) {
          bedDays = Math.max(1, Math.ceil((Date.now() - admittedAt.getTime()) / (1000 * 60 * 60 * 24)))
        }

        data.status = data.status ?? 'Available'
        data.admittedAt = null

        // Update visit if it exists
        if (existing.currentVisitId) {
          await db.patientVisit.update({
            where: { id: existing.currentVisitId },
            data: { roomNumber: null },
          })
        }

        logAudit({
          userId: auth.user!.id,
          userName: auth.user!.email,
          userEmail: auth.user!.email,
          userRole: auth.role!,
          action: 'UPDATE',
          module: 'beds',
          details: { bedId: id, action: 'released', patientId: existing.currentPatientId, bedDays },
          ...extractRequestInfo(request),
        })
      }
    }

    const updated = await db.bed.update({
      where: { id },
      data,
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'UPDATE',
      module: 'beds',
      details: { bedId: updated.bedId, changedFields: Object.keys(parsed.data) },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[BED_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update bed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}