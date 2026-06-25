import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'

const updateTranslationSchema = z.object({
  locale: z.string().trim().optional(),
  namespace: z.string().trim().optional(),
  key: z.string().trim().optional(),
  value: z.string().trim().min(1, 'Value cannot be empty').optional(),
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
      return NextResponse.json({ error: 'Translation ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateTranslationSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await db.translation.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Translation not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (parsed.data.locale !== undefined) updateData.locale = parsed.data.locale
    if (parsed.data.namespace !== undefined) updateData.namespace = parsed.data.namespace
    if (parsed.data.key !== undefined) updateData.key = parsed.data.key
    if (parsed.data.value !== undefined) updateData.value = parsed.data.value

    const updated = await db.translation.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[TRANSLATION_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update translation', details: error instanceof Error ? error.message : 'Unknown error' },
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
      return NextResponse.json({ error: 'Translation ID is required' }, { status: 400 })
    }

    const existing = await db.translation.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Translation not found' }, { status: 404 })
    }

    await db.translation.delete({ where: { id } })
    return NextResponse.json({ data: { message: 'Translation deleted successfully' } })
  } catch (error) {
    console.error('[TRANSLATION_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete translation', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
