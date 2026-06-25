import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  campDate: z.string().optional(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  location: z.string().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  organizer: z.string().nullable().optional(),
  contactPerson: z.string().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  campType: z.string().optional(),
  expectedCount: z.number().optional(),
  actualCount: z.number().optional(),
  status: z.string().optional(),
  notes: z.string().nullable().optional(),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request, '/api/camps')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    const camp = await db.healthCamp.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        registrations: {
          orderBy: { registeredAt: 'desc' },
          include: {
            patient: { select: { id: true, patientId: true, name: true, phone: true } },
          },
        },
      },
    })
    if (!camp) return NextResponse.json({ error: 'Camp not found' }, { status: 404 })
    return NextResponse.json({ data: camp })
  } catch (error) {
    console.error('[CAMP_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch camp', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request, '/api/camps')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await db.healthCamp.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Camp not found' }, { status: 404 })

    const camp = await db.healthCamp.update({ where: { id }, data: parsed.data })

    logAudit({
      userId: auth.userId!,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'UPDATE',
      module: 'feedback',
      details: { campId: camp.campId, name: camp.name, status: camp.status },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: camp })
  } catch (error) {
    console.error('[CAMP_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update camp', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request, '/api/camps')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'DELETE')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    const existing = await db.healthCamp.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Camp not found' }, { status: 404 })

    await db.healthCamp.delete({ where: { id } })

    logAudit({
      userId: auth.userId!,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'DELETE',
      module: 'feedback',
      details: { campId: existing.campId, name: existing.name },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: { id }, message: 'Camp deleted successfully' })
  } catch (error) {
    console.error('[CAMP_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete camp', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
