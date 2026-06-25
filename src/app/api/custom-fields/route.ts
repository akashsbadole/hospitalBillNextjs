import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'
import { z } from 'zod'

const FIELD_TYPES = ['text', 'number', 'date', 'select', 'multi_select', 'textarea', 'checkbox', 'boolean'] as const
const ENTITY_TYPES = ['Patient', 'Visit', 'Medicine', 'Invoice', 'Appointment'] as const

const createFieldSchema = z.object({
  entityType: z.enum(ENTITY_TYPES),
  label: z.string().trim().min(1, 'Label is required'),
  fieldType: z.enum(FIELD_TYPES),
  options: z.string().optional(),
  required: z.boolean().default(false),
  placeholder: z.string().optional(),
  sortOrder: z.number().int().default(0),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/custom-fields')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const entityType = searchParams.get('entityType')
    const activeOnly = searchParams.get('activeOnly') !== 'false'

    const where: Record<string, unknown> = {}
    if (entityType) where.entityType = entityType
    if (activeOnly) where.isActive = true

    const fields = await db.customField.findMany({
      where,
      orderBy: [{ entityType: 'asc' }, { sortOrder: 'asc' }, { label: 'asc' }],
    })

    return NextResponse.json({ data: fields })
  } catch (error) {
    console.error('[CUSTOM_FIELDS_GET]', error)
    return NextResponse.json({ error: 'Failed to fetch custom fields' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/custom-fields')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const body = await request.json()
    const data = createFieldSchema.parse(body)

    const field = await db.customField.create({ data })

    return NextResponse.json({ data: field }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.flatten() }, { status: 400 })
    }
    console.error('[CUSTOM_FIELDS_POST]', error)
    return NextResponse.json({ error: 'Failed to create custom field' }, { status: 500 })
  }
}
