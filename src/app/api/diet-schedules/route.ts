import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'

const createDietScheduleSchema = z.object({
  orderId: z.string().trim().min(1, 'Order ID is required'),
  mealTime: z.string().trim().min(1, 'Meal time is required'),
  items: z.string().optional(),
  instructions: z.string().optional(),
  servedAt: z.string().optional(),
  servedBy: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/diet-orders')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { searchParams } = request.nextUrl
    const orderId = searchParams.get('orderId')

    const where: Record<string, unknown> = {}
    if (orderId) where.orderId = orderId

    const schedules = await db.dietSchedule.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        order: { select: { id: true, orderId: true, dietType: true, patientId: true } },
      },
    })

    return NextResponse.json({ data: schedules })
  } catch (error) {
    console.error('[DIET_SCHEDULES_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch diet schedules', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/diet-orders')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createDietScheduleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const order = await db.dietOrder.findUnique({ where: { id: data.orderId } })
    if (!order) {
      return NextResponse.json({ error: 'Diet order not found' }, { status: 404 })
    }

    const schedule = await db.dietSchedule.create({
      data: {
        orderId: data.orderId,
        mealTime: data.mealTime,
        items: data.items ?? null,
        instructions: data.instructions ?? null,
        servedAt: data.servedAt ? new Date(data.servedAt) : null,
        servedBy: data.servedBy ?? null,
      },
    })

    return NextResponse.json({ data: schedule }, { status: 201 })
  } catch (error) {
    console.error('[DIET_SCHEDULES_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create diet schedule', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
