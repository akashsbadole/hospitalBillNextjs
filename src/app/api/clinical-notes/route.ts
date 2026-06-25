import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'
import { z } from 'zod'

const createSchema = z.object({
  patientId: z.string().min(1),
  visitId: z.string().optional(),
  noteType: z.enum(['SOAP', 'Progress', 'Procedure', 'Consult', 'Discharge']).default('SOAP'),
  subjective: z.string().optional(),
  objective: z.string().optional(),
  assessment: z.string().optional(),
  plan: z.string().optional(),
  icdCodes: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/clinical-notes')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const patientId = searchParams.get('patientId')
    const visitId = searchParams.get('visitId')
    const noteType = searchParams.get('noteType')

    const where: Record<string, unknown> = {}
    if (patientId) where.patientId = patientId
    if (visitId) where.visitId = visitId
    if (noteType) where.noteType = noteType

    const notes = await db.clinicalNote.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true } },
        visit: { select: { id: true, visitType: true, stage: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ data: notes })
  } catch (error) {
    console.error('[CLINICAL_NOTES_GET]', error)
    return NextResponse.json({ error: 'Failed to fetch clinical notes' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/clinical-notes')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const body = await request.json()
    const data = createSchema.parse(body)
    const note = await db.clinicalNote.create({
      data: {
        ...data,
        createdById: auth.userId!,
      },
    })
    return NextResponse.json({ data: note }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.flatten() }, { status: 400 })
    }
    console.error('[CLINICAL_NOTES_POST]', error)
    return NextResponse.json({ error: 'Failed to create clinical note' }, { status: 500 })
  }
}
