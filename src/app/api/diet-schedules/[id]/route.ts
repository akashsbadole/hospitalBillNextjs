import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'

const updateDietScheduleSchema = z.object({
  mealTime: z.string().trim().optional(),
  items: z.string().optional(),
  instructions: z.string().optional(),
  servedAt: z.string().optional(),
  servedBy: z.string().optional(),
})

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
      return NextResponse.json({ error: 'Schedule ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateDietScheduleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await db.dietSchedule.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Diet schedule not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (parsed.data.mealTime !== undefined) updateData.mealTime = parsed.data.mealTime
    if (parsed.data.items !== undefined) updateData.items = parsed.data.items
    if (parsed.data.instructions !== undefined) updateData.instructions = parsed.data.instructions
    if (parsed.data.servedAt !== undefined) updateData.servedAt = parsed.data.servedAt ? new Date(parsed.data.servedAt) : null
    if (parsed.data.servedBy !== undefined) updateData.servedBy = parsed.data.servedBy

    const updated = await db.dietSchedule.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[DIET_SCHEDULE_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update diet schedule', details: error instanceof Error ? error.message : 'Unknown error' },
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
      return NextResponse.json({ error: 'Schedule ID is required' }, { status: 400 })
    }

    const existing = await db.dietSchedule.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Diet schedule not found' }, { status: 404 })
    }

    await db.dietSchedule.delete({ where: { id } })
    return NextResponse.json({ data: { message: 'Diet schedule deleted successfully' } })
  } catch (error) {
    console.error('[DIET_SCHEDULE_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete diet schedule', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
