import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const releaseSchema = z.object({
  bedId: z.string().min(1, 'Bed ID is required'),
})

// ── POST: release bed ───────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/beds')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = releaseSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { bedId } = parsed.data

    // Validate bed
    const bed = await db.bed.findUnique({
      where: { id: bedId },
      include: {
        currentPatient: { select: { id: true, patientId: true, name: true } },
        currentVisit: { select: { id: true, visitId: true } },
        ward: { select: { id: true, wardId: true, name: true, floor: true } },
      },
    })
    if (!bed) {
      return NextResponse.json({ error: 'Bed not found' }, { status: 404 })
    }
    if (bed.status !== 'Occupied') {
      return NextResponse.json(
        { error: 'Bed is not currently occupied', details: `Current status: ${bed.status}` },
        { status: 400 }
      )
    }

    // Calculate bed days
    let bedDays = 0
    if (bed.admittedAt) {
      bedDays = Math.max(1, Math.ceil((Date.now() - bed.admittedAt.getTime()) / (1000 * 60 * 60 * 24)))
    }

    const totalAmount = bedDays * bed.dailyRate

    // Release the bed
    const updatedBed = await db.bed.update({
      where: { id: bedId },
      data: {
        status: 'Available',
        currentPatientId: null,
        currentVisitId: null,
        admittedAt: null,
      },
      include: {
        ward: { select: { id: true, wardId: true, name: true, floor: true } },
      },
    })

    // Clear roomNumber from the visit
    if (bed.currentVisit) {
      await db.patientVisit.update({
        where: { id: bed.currentVisit.id },
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
      details: {
        bedId: bed.bedId,
        bedNumber: bed.bedNumber,
        patientId: bed.currentPatient?.patientId,
        patientName: bed.currentPatient?.name,
        visitId: bed.currentVisit?.visitId,
        action: 'released',
        bedDays,
        totalAmount,
        dailyRate: bed.dailyRate,
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({
      data: {
        ...updatedBed,
        _releaseInfo: { bedDays, totalAmount, dailyRate: bed.dailyRate },
      },
    })
  } catch (error) {
    console.error('[BED_RELEASE]', error)
    return NextResponse.json(
      { error: 'Failed to release bed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}