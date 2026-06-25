import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'
import { z } from 'zod'

const updateFieldSchema = z.object({
  label: z.string().trim().min(1).optional(),
  fieldType: z.enum(['text', 'number', 'date', 'select', 'multi_select', 'textarea', 'checkbox', 'boolean']).optional(),
  options: z.string().nullable().optional(),
  required: z.boolean().optional(),
  placeholder: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  entityType: z.enum(['Patient', 'Visit', 'Medicine', 'Invoice', 'Appointment']).optional(),
})

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request, '/api/custom-fields', )
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    const body = await request.json()
    const data = updateFieldSchema.parse(body)

    const existing = await db.customField.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Custom field not found' }, { status: 404 })
    }

    const field = await db.customField.update({ where: { id }, data })
    return NextResponse.json({ data: field })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.flatten() }, { status: 400 })
    }
    console.error('[CUSTOM_FIELDS_PUT]', error)
    return NextResponse.json({ error: 'Failed to update custom field' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request, '/api/custom-fields', )
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    const existing = await db.customField.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Custom field not found' }, { status: 404 })
    }

    await db.customField.delete({ where: { id } })
    return NextResponse.json({ message: 'Custom field deleted' })
  } catch (error) {
    console.error('[CUSTOM_FIELDS_DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete custom field' }, { status: 500 })
  }
}
