import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'

const updateHl7LogSchema = z.object({
  status: z.enum(['Processed', 'Failed', 'Pending']).optional(),
  error: z.string().nullable().optional(),
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
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateHl7LogSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await db.hl7MessageLog.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'HL7 message not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status
    if (parsed.data.error !== undefined) updateData.error = parsed.data.error

    const updated = await db.hl7MessageLog.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[HL7_LOG_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update HL7 message', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
