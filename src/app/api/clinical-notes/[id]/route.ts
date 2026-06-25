import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'
import { z } from 'zod'

const updateSchema = z.object({
  noteType: z.enum(['SOAP', 'Progress', 'Procedure', 'Consult', 'Discharge']).optional(),
  subjective: z.string().nullable().optional(),
  objective: z.string().nullable().optional(),
  assessment: z.string().nullable().optional(),
  plan: z.string().nullable().optional(),
  icdCodes: z.string().nullable().optional(),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request, '/api/clinical-notes')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    const note = await db.clinicalNote.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        visit: { select: { id: true, visitType: true, stage: true } },
      },
    })
    if (!note) return NextResponse.json({ error: 'Clinical note not found' }, { status: 404 })
    return NextResponse.json({ data: note })
  } catch (error) {
    console.error('[CLINICAL_NOTE_GET]', error)
    return NextResponse.json({ error: 'Failed to fetch clinical note' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request, '/api/clinical-notes')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    const body = await request.json()
    const data = updateSchema.parse(body)
    const note = await db.clinicalNote.update({ where: { id }, data })
    return NextResponse.json({ data: note })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.flatten() }, { status: 400 })
    }
    console.error('[CLINICAL_NOTE_PUT]', error)
    return NextResponse.json({ error: 'Failed to update clinical note' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request, '/api/clinical-notes')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    await db.clinicalNote.delete({ where: { id } })
    return NextResponse.json({ message: 'Clinical note deleted' })
  } catch (error) {
    console.error('[CLINICAL_NOTE_DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete clinical note' }, { status: 500 })
  }
}
