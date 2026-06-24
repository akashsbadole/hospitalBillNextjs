import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'
import { updateImagingStudySchema } from '@/lib/validations'

const VALID_TRANSITIONS: Record<string, string[]> = {
  Ordered: ['Scheduled'],
  Scheduled: ['In-Progress'],
  'In-Progress': ['Completed'],
  Completed: ['Reviewed'],
  Reviewed: ['Reported'],
}

function canTransition(from: string, to: string): boolean {
  const allowed = VALID_TRANSITIONS[from]
  if (!allowed) return false
  return allowed.includes(to)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/imaging')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Study ID is required' }, { status: 400 })
    }

    const study = await db.imagingStudy.findUnique({
      where: { id },
      include: {
        patient: {
          select: { id: true, patientId: true, name: true, phone: true, email: true, gender: true, dateOfBirth: true },
        },
        doctor: {
          select: { id: true, doctorId: true, name: true, specialization: true, qualification: true },
        },
        visit: {
          select: { id: true, visitId: true, visitType: true, department: true, chiefComplaint: true, createdAt: true },
        },
      },
    })

    if (!study) {
      return NextResponse.json({ error: 'Imaging study not found' }, { status: 404 })
    }

    return NextResponse.json({ data: study })
  } catch (error) {
    console.error('[IMAGING_STUDY_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch imaging study', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/imaging')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Study ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateImagingStudySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const existing = await db.imagingStudy.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Imaging study not found' }, { status: 404 })
    }

    if (data.status && !canTransition(existing.status, data.status)) {
      return NextResponse.json(
        {
          error: 'Invalid status transition',
          details: `Cannot transition from "${existing.status}" to "${data.status}". Allowed transitions: ${(VALID_TRANSITIONS[existing.status] || ['none']).join(', ')}`,
        },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}

    if (data.status) updateData.status = data.status
    if (data.status === 'Scheduled' && data.scheduledAt) updateData.scheduledAt = new Date(data.scheduledAt)
    if (data.status === 'Completed' && !existing.performedAt) updateData.performedAt = new Date()
    if (data.status === 'Reported' && !existing.reportedAt) updateData.reportedAt = new Date()
    if (data.findings !== undefined) updateData.findings = data.findings
    if (data.impression !== undefined) updateData.impression = data.impression
    if (data.technique !== undefined) updateData.technique = data.technique
    if (data.radiologistId !== undefined) updateData.radiologistId = data.radiologistId
    if (data.imagesCount !== undefined) updateData.imagesCount = data.imagesCount
    if (data.reportUrl !== undefined) updateData.reportUrl = data.reportUrl
    if (data.imagesUrl !== undefined) updateData.imagesUrl = data.imagesUrl
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.contrastUsed !== undefined) updateData.contrastUsed = data.contrastUsed
    if (data.contrastType !== undefined) updateData.contrastType = data.contrastType

    const updated = await db.imagingStudy.update({
      where: { id },
      data: updateData,
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: existing.status !== updated.status ? 'STATUS_CHANGE' : 'UPDATE',
      module: 'imaging',
      details: {
        studyId: id,
        previousStatus: existing.status,
        newStatus: updated.status,
        changedFields: Object.keys(data),
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[IMAGING_STUDY_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update imaging study', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/imaging')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Study ID is required' }, { status: 400 })
    }

    const existing = await db.imagingStudy.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Imaging study not found' }, { status: 404 })
    }

    await db.imagingStudy.delete({ where: { id } })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'DELETE',
      module: 'imaging',
      details: { studyId: existing.studyId, modality: existing.modality, bodyPart: existing.bodyPart },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: { message: 'Imaging study deleted successfully' } })
  } catch (error) {
    console.error('[IMAGING_STUDY_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete imaging study', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
