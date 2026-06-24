import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const createWardSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  floor: z.number().int().min(0).max(100).default(1),
  status: z.enum(['Active', 'Inactive']).default('Active'),
})

// ── GET: list wards with bed count summary ────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/beds')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const wards = await db.ward.findMany({
      include: {
        beds: {
          select: { id: true, status: true },
        },
      },
      orderBy: [{ floor: 'asc' }, { name: 'asc' }],
    })

    const data = wards.map((w) => {
      const total = w.beds.length
      const available = w.beds.filter((b) => b.status === 'Available').length
      const occupied = w.beds.filter((b) => b.status === 'Occupied').length
      const maintenance = w.beds.filter((b) => b.status === 'Maintenance').length
      const reserved = w.beds.filter((b) => b.status === 'Reserved').length
      return {
        ...w,
        _count: { total, available, occupied, maintenance, reserved },
        beds: undefined,
      }
    })

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[WARDS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch wards', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── POST: create ward ─────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/beds')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createWardSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const lastWard = await db.ward.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { wardId: true },
    })
    const num = lastWard ? parseInt(lastWard.wardId.replace('WRD-', ''), 10) + 1 : 1
    const wardId = `WRD-${String(num).padStart(4, '0')}`

    const ward = await db.ward.create({
      data: { ...parsed.data, wardId },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'beds',
      details: { wardId: ward.wardId, name: ward.name },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: ward }, { status: 201 })
  } catch (error) {
    console.error('[WARDS_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create ward', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}