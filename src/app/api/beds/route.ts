import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const createBedSchema = z.object({
  wardId: z.string().min(1, 'Ward is required'),
  bedNumber: z.string().trim().min(1, 'Bed number is required').max(20),
  bedType: z.enum(['Standard', 'Deluxe', 'Suite', 'ICU Bed', 'Emergency']).default('Standard'),
  dailyRate: z.number().min(0, 'Rate cannot be negative').default(0),
})

// ── GET: list beds with filters ──────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/beds')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { searchParams } = request.nextUrl
    const wardId = searchParams.get('wardId')?.trim() || ''
    const status = searchParams.get('status')?.trim() || ''
    const floor = searchParams.get('floor')?.trim() || ''

    const where: Record<string, unknown> = {}
    if (wardId) where.wardId = wardId
    if (status) where.status = status
    if (floor) {
      where.ward = { floor: parseInt(floor, 10) }
    }

    const beds = await db.bed.findMany({
      where,
      include: {
        ward: { select: { id: true, wardId: true, name: true, floor: true } },
        currentPatient: { select: { id: true, patientId: true, name: true, phone: true } },
        currentVisit: { select: { id: true, visitId: true, visitType: true, stage: true } },
      },
      orderBy: [{ ward: { floor: 'asc' } }, { bedNumber: 'asc' }],
    })

    return NextResponse.json({ data: beds })
  } catch (error) {
    console.error('[BEDS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch beds', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── POST: create bed ─────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/beds')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createBedSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    // Verify ward exists
    const ward = await db.ward.findUnique({ where: { id: parsed.data.wardId } })
    if (!ward) {
      return NextResponse.json({ error: 'Ward not found' }, { status: 404 })
    }

    // Check for duplicate bed number in the same ward
    const existingBed = await db.bed.findFirst({
      where: {
        wardId: parsed.data.wardId,
        bedNumber: parsed.data.bedNumber,
      },
    })
    if (existingBed) {
      return NextResponse.json(
        { error: 'Bed number already exists in this ward', details: `Bed number "${parsed.data.bedNumber}" is already taken.` },
        { status: 409 }
      )
    }

    const lastBed = await db.bed.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { bedId: true },
    })
    const num = lastBed ? parseInt(lastBed.bedId.replace('BED-', ''), 10) + 1 : 1
    const bedId = `BED-${String(num).padStart(4, '0')}`

    const bed = await db.bed.create({
      data: {
        ...parsed.data,
        bedId,
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'beds',
      details: { bedId: bed.bedId, bedNumber: bed.bedNumber, wardId: parsed.data.wardId },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: bed }, { status: 201 })
  } catch (error) {
    console.error('[BEDS_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create bed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}