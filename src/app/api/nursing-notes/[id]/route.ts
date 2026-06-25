import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const updateNoteSchema = z.object({
  shift: z.enum(['Morning', 'Evening', 'Night']).optional(),
  subjective: z.string().trim().optional(),
  objective: z.string().trim().optional(),
  assessment: z.string().trim().optional(),
  plan: z.string().trim().optional(),
  recordedBy: z.string().trim().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/nursing-notes')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    const nursingNote = await db.nursingNote.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, patientId: true, name: true } },
        visit: { select: { id: true, visitId: true, visitType: true } },
      },
    })

    if (!nursingNote) {
      return NextResponse.json({ error: 'Nursing note not found' }, { status: 404 })
    }

    return NextResponse.json({ data: nursingNote })
  } catch (error) {
    console.error('[NURSING_NOTES_ID_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch nursing note', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/nursing-notes')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    const existing = await db.nursingNote.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Nursing note not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = updateNoteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const nursingNote = await db.nursingNote.update({
      where: { id },
      data: {
        ...(data.shift !== undefined && { shift: data.shift }),
        ...(data.subjective !== undefined && { subjective: data.subjective }),
        ...(data.objective !== undefined && { objective: data.objective }),
        ...(data.assessment !== undefined && { assessment: data.assessment }),
        ...(data.plan !== undefined && { plan: data.plan }),
        ...(data.recordedBy !== undefined && { recordedBy: data.recordedBy }),
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
      action: 'UPDATE',
      module: 'patients',
      details: { nursingNoteId: id, patientId: existing.patientId },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: nursingNote })
  } catch (error) {
    console.error('[NURSING_NOTES_ID_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update nursing note', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/nursing-notes')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'DELETE')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    const existing = await db.nursingNote.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Nursing note not found' }, { status: 404 })
    }

    await db.nursingNote.delete({ where: { id } })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'DELETE',
      module: 'patients',
      details: { nursingNoteId: id, patientId: existing.patientId },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: { message: 'Nursing note deleted' } })
  } catch (error) {
    console.error('[NURSING_NOTES_ID_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete nursing note', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
