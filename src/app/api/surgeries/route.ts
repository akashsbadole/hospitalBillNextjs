import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'
import { z } from 'zod'

const createSchema = z.object({
  patientId: z.string().min(1, 'Patient is required'),
  doctorId: z.string().min(1, 'Doctor is required'),
  otId: z.string().optional(),
  type: z.enum(['Emergency', 'Planned', 'Day-Care']).default('Planned'),
  category: z.enum(['Major', 'Minor', 'Micro']).default('Minor'),
  anesthesiaType: z.string().optional(),
  scheduledDate: z.string().optional(),
  scheduledTime: z.string().optional(),
  diagnosis: z.string().optional(),
  procedure: z.string().optional(),
  notes: z.string().optional(),
  surgicalTeam: z.string().optional(),
  branchId: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/surgeries')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const status = searchParams.get('status')
    const doctorId = searchParams.get('doctorId')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    const where: Record<string, unknown> = {}
    if (status && status !== 'all') where.status = status
    if (doctorId) where.doctorId = doctorId
    if (fromDate || toDate) {
      const df: Record<string, string> = {}
      if (fromDate) df.gte = fromDate
      if (toDate) df.lte = toDate
      where.scheduledDate = df
    }

    const surgeries = await db.surgery.findMany({
      where,
      include: {
        patient: { select: { id: true, patientId: true, name: true, phone: true } },
        doctor: { select: { id: true, doctorId: true, name: true, specialization: true } },
        ot: { select: { id: true, name: true, type: true } },
      },
      orderBy: [{ scheduledDate: 'desc' }, { scheduledTime: 'desc' }],
    })

    return NextResponse.json({ data: surgeries })
  } catch (error) {
    console.error('[SURGERIES_GET]', error)
    return NextResponse.json({ error: 'Failed to fetch surgeries' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/surgeries')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const body = await request.json()
    const parsed = createSchema.parse(body)
    const surgery = await db.surgery.create({
      data: {
        ...parsed,
        surgeryId: `SGR-${Date.now()}`,
        branchId: parsed.branchId ?? null,
        surgicalTeam: parsed.surgicalTeam ?? null,
      },
    })
    return NextResponse.json({ data: surgery }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.flatten() }, { status: 400 })
    }
    console.error('[SURGERIES_POST]', error)
    return NextResponse.json({ error: 'Failed to create surgery' }, { status: 500 })
  }
}
