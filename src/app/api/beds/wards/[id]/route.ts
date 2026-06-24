import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const updateWardSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  floor: z.number().int().min(0).max(100).optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
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
      return NextResponse.json({ error: 'Ward ID is required' }, { status: 400 })
    }

    const ward = await db.ward.findUnique({
      where: { id },
      include: {
        beds: {
          include: {
            currentPatient: { select: { id: true, patientId: true, name: true, phone: true } },
            currentVisit: { select: { id: true, visitId: true, visitType: true, stage: true } },
          },
          orderBy: { bedNumber: 'asc' },
        },
      },
    })

    if (!ward) {
      return NextResponse.json({ error: 'Ward not found' }, { status: 404 })
    }

    return NextResponse.json({ data: ward })
  } catch (error) {
    console.error('[WARD_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch ward', details: error instanceof Error ? error.message : 'Unknown error' },
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
      return NextResponse.json({ error: 'Ward ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateWardSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await db.ward.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Ward not found' }, { status: 404 })
    }

    const updated = await db.ward.update({
      where: { id },
      data: parsed.data,
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'UPDATE',
      module: 'beds',
      details: { wardId: id, name: updated.name, changedFields: Object.keys(parsed.data) },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[WARD_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update ward', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/beds')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'DELETE')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Ward ID is required' }, { status: 400 })
    }

    const existing = await db.ward.findUnique({
      where: { id },
      include: { beds: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Ward not found' }, { status: 404 })
    }

    // Check for occupied beds
    const occupiedBeds = existing.beds.filter((b) => b.status === 'Occupied')
    if (occupiedBeds.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete ward with occupied beds', details: `Please release ${occupiedBeds.length} occupied bed(s) first.` },
        { status: 400 }
      )
    }

    // Delete beds first, then the ward
    if (existing.beds.length > 0) {
      await db.bed.deleteMany({ where: { wardId: id } })
    }
    await db.ward.delete({ where: { id } })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'DELETE',
      module: 'beds',
      details: { wardId: existing.wardId, name: existing.name },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: { success: true } })
  } catch (error) {
    console.error('[WARD_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete ward', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}