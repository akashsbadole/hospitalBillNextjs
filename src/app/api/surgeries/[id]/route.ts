import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'
import { z } from 'zod'

const updateSchema = z.object({
  status: z.enum(['Scheduled', 'In-Progress', 'Completed', 'Cancelled', 'Postponed']).optional(),
  otId: z.string().nullable().optional(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  diagnosis: z.string().optional(),
  procedure: z.string().optional(),
  notes: z.string().optional(),
  anesthesiaType: z.string().nullable().optional(),
  surgicalTeam: z.string().nullable().optional(),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request, '/api/surgeries')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    const surgery = await db.surgery.findUnique({
      where: { id },
      include: {
        patient: true,
        doctor: { select: { id: true, name: true, specialization: true } },
        ot: true,
      },
    })
    if (!surgery) return NextResponse.json({ error: 'Surgery not found' }, { status: 404 })
    return NextResponse.json({ data: surgery })
  } catch (error) {
    console.error('[SURGERY_GET]', error)
    return NextResponse.json({ error: 'Failed to fetch surgery' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request, '/api/surgeries')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    const body = await request.json()
    const data = updateSchema.parse(body)
    const surgery = await db.surgery.update({ where: { id }, data })
    return NextResponse.json({ data: surgery })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.flatten() }, { status: 400 })
    }
    if ((error as any)?.code === 'P2025') {
      return NextResponse.json({ error: 'Surgery not found' }, { status: 404 })
    }
    console.error('[SURGERY_PUT]', error)
    return NextResponse.json({ error: 'Failed to update surgery' }, { status: 500 })
  }
}
