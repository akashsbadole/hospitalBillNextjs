import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'
import { z } from 'zod'

const createSchema = z.object({
  patientId: z.string().min(1),
  medicationName: z.string().min(1, 'Medication name is required'),
  strength: z.string().optional(),
  dosageForm: z.string().optional(),
  frequency: z.string().optional(),
  route: z.string().optional(),
  prescribedDate: z.string().optional(),
  prescribedBy: z.string().optional(),
  notes: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/active-medications')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const patientId = searchParams.get('patientId')
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (patientId) where.patientId = patientId
    if (status && status !== 'all') where.status = status

    const medications = await db.activeMedication.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    })
    return NextResponse.json({ data: medications })
  } catch (error) {
    console.error('[ACTIVE_MEDS_GET]', error)
    return NextResponse.json({ error: 'Failed to fetch medications' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/active-medications')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const body = await request.json()
    const data = createSchema.parse(body)
    const medication = await db.activeMedication.create({ data })
    return NextResponse.json({ data: medication }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.flatten() }, { status: 400 })
    }
    console.error('[ACTIVE_MEDS_POST]', error)
    return NextResponse.json({ error: 'Failed to create medication' }, { status: 500 })
  }
}
