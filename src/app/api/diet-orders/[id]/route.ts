import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const updateDietOrderSchema = z.object({
  dietType: z.string().trim().optional(),
  mealPlan: z.string().optional(),
  preferences: z.string().optional(),
  allergies: z.string().optional(),
  instructions: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['Active', 'Completed', 'Cancelled']).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/diet-orders')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Diet order ID is required' }, { status: 400 })
    }

    const order = await db.dietOrder.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, patientId: true, name: true, phone: true } },
        visit: { select: { id: true, visitId: true, visitType: true, department: true } },
        schedules: { orderBy: { createdAt: 'asc' } },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Diet order not found' }, { status: 404 })
    }

    return NextResponse.json({ data: order })
  } catch (error) {
    console.error('[DIET_ORDER_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch diet order', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/diet-orders')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Diet order ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateDietOrderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await db.dietOrder.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Diet order not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    const fields = ['dietType', 'mealPlan', 'preferences', 'allergies', 'instructions', 'status'] as const
    for (const field of fields) {
      if (parsed.data[field] !== undefined) updateData[field] = parsed.data[field]
    }
    if (parsed.data.startDate !== undefined) updateData.startDate = parsed.data.startDate || null
    if (parsed.data.endDate !== undefined) updateData.endDate = parsed.data.endDate || null

    const updated = await db.dietOrder.update({
      where: { id },
      data: updateData,
      include: {
        patient: { select: { id: true, patientId: true, name: true } },
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: existing.status !== updated.status ? 'STATUS_CHANGE' : 'UPDATE',
      module: 'patients',
      details: { orderId: updated.orderId, changedFields: Object.keys(parsed.data) },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[DIET_ORDER_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update diet order', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/diet-orders')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'DELETE')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Diet order ID is required' }, { status: 400 })
    }

    const existing = await db.dietOrder.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Diet order not found' }, { status: 404 })
    }

    await db.dietOrder.delete({ where: { id } })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'DELETE',
      module: 'patients',
      details: { orderId: existing.orderId, dietType: existing.dietType },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: { message: 'Diet order deleted successfully' } })
  } catch (error) {
    console.error('[DIET_ORDER_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete diet order', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
