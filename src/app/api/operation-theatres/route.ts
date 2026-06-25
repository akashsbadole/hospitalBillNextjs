import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  type: z.string().default('General'),
  floor: z.string().optional(),
  branchId: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/operation-theatres')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const branchId = searchParams.get('branchId')
    const where: Record<string, unknown> = {}
    if (branchId) where.branchId = branchId

    const theatres = await db.operationTheatre.findMany({
      where,
      include: { _count: { select: { surgeries: true } } },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json({ data: theatres })
  } catch (error) {
    console.error('[OT_GET]', error)
    return NextResponse.json({ error: 'Failed to fetch operation theatres' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/operation-theatres')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const body = await request.json()
    const parsed = createSchema.parse(body)
    const theatre = await db.operationTheatre.create({
      data: {
        otId: `OT-${Date.now()}`,
        name: parsed.name,
        type: parsed.type,
        floor: parsed.floor ?? null,
        branchId: parsed.branchId ?? null,
      },
    })
    return NextResponse.json({ data: theatre }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.flatten() }, { status: 400 })
    }
    console.error('[OT_POST]', error)
    return NextResponse.json({ error: 'Failed to create operation theatre' }, { status: 500 })
  }
}
