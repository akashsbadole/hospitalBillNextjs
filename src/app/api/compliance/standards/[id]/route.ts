import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'

const updateStandardSchema = z.object({
  authority: z.string().trim().optional(),
  chapter: z.string().trim().optional(),
  code: z.string().trim().optional(),
  title: z.string().trim().optional(),
  description: z.string().nullable().optional(),
  isMandatory: z.boolean().optional(),
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
      return NextResponse.json({ error: 'Standard ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateStandardSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await db.complianceStandard.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Compliance standard not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (parsed.data.authority !== undefined) updateData.authority = parsed.data.authority
    if (parsed.data.chapter !== undefined) updateData.chapter = parsed.data.chapter
    if (parsed.data.code !== undefined) updateData.code = parsed.data.code
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description
    if (parsed.data.isMandatory !== undefined) updateData.isMandatory = parsed.data.isMandatory

    const updated = await db.complianceStandard.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[COMPLIANCE_STANDARD_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update compliance standard', details: error instanceof Error ? error.message : 'Unknown error' },
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
      return NextResponse.json({ error: 'Standard ID is required' }, { status: 400 })
    }

    const existing = await db.complianceStandard.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Compliance standard not found' }, { status: 404 })
    }

    await db.complianceStandard.delete({ where: { id } })
    return NextResponse.json({ data: { message: 'Compliance standard deleted successfully' } })
  } catch (error) {
    console.error('[COMPLIANCE_STANDARD_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete compliance standard', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
