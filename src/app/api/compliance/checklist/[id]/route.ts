import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'

const updateChecklistSchema = z.object({
  title: z.string().trim().optional(),
  description: z.string().nullable().optional(),
  status: z.enum(['Pending', 'In-Progress', 'Compliant', 'Non-Compliant', 'Not-Applicable']).optional(),
  score: z.number().int().min(0).max(100).nullable().optional(),
  evidence: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional(),
  completedDate: z.string().nullable().optional(),
  assignedToId: z.string().nullable().optional(),
  remarks: z.string().nullable().optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/settings')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Checklist ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateChecklistSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await db.complianceChecklist.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Compliance checklist not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status
    if (parsed.data.score !== undefined) updateData.score = parsed.data.score
    if (parsed.data.evidence !== undefined) updateData.evidence = parsed.data.evidence
    if (parsed.data.targetDate !== undefined) updateData.targetDate = parsed.data.targetDate
    if (parsed.data.completedDate !== undefined) updateData.completedDate = parsed.data.completedDate
    if (parsed.data.assignedToId !== undefined) updateData.assignedToId = parsed.data.assignedToId
    if (parsed.data.remarks !== undefined) updateData.remarks = parsed.data.remarks

    // Auto-set completedDate when marking as Compliant
    if (parsed.data.status === 'Compliant' && !parsed.data.completedDate) {
      updateData.completedDate = new Date().toISOString().split('T')[0]
    }

    const updated = await db.complianceChecklist.update({
      where: { id },
      data: updateData,
      include: {
        standard: { select: { id: true, standardId: true, authority: true, code: true, title: true } },
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[COMPLIANCE_CHECKLIST_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update compliance checklist', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/settings')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'DELETE')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Checklist ID is required' }, { status: 400 })
    }

    const existing = await db.complianceChecklist.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Compliance checklist not found' }, { status: 404 })
    }

    await db.complianceChecklist.delete({ where: { id } })
    return NextResponse.json({ data: { message: 'Compliance checklist deleted successfully' } })
  } catch (error) {
    console.error('[COMPLIANCE_CHECKLIST_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete compliance checklist', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
