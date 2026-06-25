import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'

const updateAuditSchema = z.object({
  title: z.string().trim().optional(),
  auditDate: z.string().optional(),
  auditor: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  overallScore: z.number().min(0).max(100).nullable().optional(),
  strengths: z.string().nullable().optional(),
  improvements: z.string().nullable().optional(),
  findings: z.string().nullable().optional(),
  status: z.enum(['Scheduled', 'In-Progress', 'Completed', 'Closed']).optional(),
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
      return NextResponse.json({ error: 'Audit ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateAuditSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await db.complianceAudit.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Compliance audit not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title
    if (parsed.data.auditDate !== undefined) updateData.auditDate = parsed.data.auditDate
    if (parsed.data.auditor !== undefined) updateData.auditor = parsed.data.auditor
    if (parsed.data.department !== undefined) updateData.department = parsed.data.department
    if (parsed.data.overallScore !== undefined) updateData.overallScore = parsed.data.overallScore
    if (parsed.data.strengths !== undefined) updateData.strengths = parsed.data.strengths
    if (parsed.data.improvements !== undefined) updateData.improvements = parsed.data.improvements
    if (parsed.data.findings !== undefined) updateData.findings = parsed.data.findings
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status

    const updated = await db.complianceAudit.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[COMPLIANCE_AUDIT_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update compliance audit', details: error instanceof Error ? error.message : 'Unknown error' },
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
      return NextResponse.json({ error: 'Audit ID is required' }, { status: 400 })
    }

    const existing = await db.complianceAudit.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Compliance audit not found' }, { status: 404 })
    }

    await db.complianceAudit.delete({ where: { id } })
    return NextResponse.json({ data: { message: 'Compliance audit deleted successfully' } })
  } catch (error) {
    console.error('[COMPLIANCE_AUDIT_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete compliance audit', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
