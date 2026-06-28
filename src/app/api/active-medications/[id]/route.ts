import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { z } from 'zod'

const updateSchema = z.object({
  medicationName: z.string().optional(),
  strength: z.string().nullable().optional(),
  dosageForm: z.string().nullable().optional(),
  frequency: z.string().nullable().optional(),
  route: z.string().nullable().optional(),
  status: z.enum(['Active', 'Discontinued', 'Completed', 'On Hold']).optional(),
  notes: z.string().nullable().optional(),
})

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request, '/api/active-medications')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    const body = await request.json()
    const data = updateSchema.parse(body)
    const medication = await db.activeMedication.update({ where: { id }, data })
    return NextResponse.json({ data: medication })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.flatten() }, { status: 400 })
    }
    console.error('[ACTIVE_MED_PUT]', error)
    return NextResponse.json({ error: 'Failed to update medication' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request, '/api/active-medications')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'DELETE')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    await db.activeMedication.delete({ where: { id } })
    return NextResponse.json({ message: 'Medication deleted' })
  } catch (error) {
    console.error('[ACTIVE_MED_DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete medication' }, { status: 500 })
  }
}
