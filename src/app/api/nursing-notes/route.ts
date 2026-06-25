import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const createNoteSchema = z.object({
  patientId: z.string().trim().min(1, 'Patient ID is required'),
  visitId: z.string().trim().optional(),
  shift: z.enum(['Morning', 'Evening', 'Night'], { message: 'Shift must be Morning, Evening, or Night' }),
  subjective: z.string().trim().optional(),
  objective: z.string().trim().optional(),
  assessment: z.string().trim().optional(),
  plan: z.string().trim().optional(),
  recordedBy: z.string().trim().optional(),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/nursing-notes')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const patientId = searchParams.get('patientId')
    const visitId = searchParams.get('visitId')
    const shift = searchParams.get('shift')

    const where: Record<string, unknown> = {}
    if (patientId) where.patientId = patientId
    if (visitId) where.visitId = visitId
    if (shift) where.shift = shift

    const nursingNotes = await db.nursingNote.findMany({
      where,
      orderBy: { recordedAt: 'desc' },
      include: {
        patient: { select: { id: true, patientId: true, name: true } },
        visit: { select: { id: true, visitId: true, visitType: true } },
      },
    })

    return NextResponse.json({ data: nursingNotes })
  } catch (error) {
    console.error('[NURSING_NOTES_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch nursing notes', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/nursing-notes')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createNoteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const patient = await db.patient.findUnique({ where: { id: data.patientId } })
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const nursingNote = await db.nursingNote.create({
      data: {
        patientId: data.patientId,
        visitId: data.visitId ?? null,
        shift: data.shift,
        subjective: data.subjective ?? null,
        objective: data.objective ?? null,
        assessment: data.assessment ?? null,
        plan: data.plan ?? null,
        recordedBy: data.recordedBy ?? null,
      },
      include: {
        patient: { select: { id: true, patientId: true, name: true } },
        visit: { select: { id: true, visitId: true, visitType: true } },
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'patients',
      details: { nursingNoteId: nursingNote.id, patientId: data.patientId },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: nursingNote }, { status: 201 })
  } catch (error) {
    console.error('[NURSING_NOTES_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create nursing note', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
