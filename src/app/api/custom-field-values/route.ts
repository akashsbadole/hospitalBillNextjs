import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'
import { z } from 'zod'

const setValuesSchema = z.object({
  entityType: z.enum(['Patient', 'Visit', 'Medicine', 'Invoice', 'Appointment']),
  entityId: z.string().min(1),
  values: z.record(z.string(), z.any().nullable()),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/custom-field-values')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')

    if (!entityType || !entityId) {
      return NextResponse.json({ error: 'entityType and entityId are required' }, { status: 400 })
    }

    const values = await db.customFieldValue.findMany({
      where: { entityType, entityId },
      include: { field: true },
    })

    const result: Record<string, { field: Record<string, unknown>; value: string | null }> = {}
    for (const v of values) {
      result[v.fieldId] = {
        field: {
          id: v.field.id,
          label: v.field.label,
          fieldType: v.field.fieldType,
          options: v.field.options,
        },
        value: v.value,
      }
    }

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('[CUSTOM_FIELD_VALUES_GET]', error)
    return NextResponse.json({ error: 'Failed to fetch custom field values' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/custom-field-values')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const body = await request.json()
    const { entityType, entityId, values } = setValuesSchema.parse(body)

    const fields = await db.customField.findMany({ where: { entityType, isActive: true } })
    const fieldMap = new Map(fields.map(f => [f.id, f]))

    const ops: Promise<unknown>[] = []

    for (const [fieldId, rawValue] of Object.entries(values)) {
      if (!fieldMap.has(fieldId)) continue

      const value = rawValue === null || rawValue === undefined || rawValue === ''
        ? null
        : String(rawValue)

      ops.push(
        db.customFieldValue.upsert({
          where: { fieldId_entityType_entityId: { fieldId, entityType, entityId } },
          create: { fieldId, entityType, entityId, value },
          update: { value },
        }),
      )
    }

    // Delete values for fields not in the submission (if value is null/empty and field was previously set)
    if (Object.keys(values).length > 0) {
      const submittedFieldIds = Object.keys(values)
      ops.push(
        db.customFieldValue.deleteMany({
          where: {
            entityType,
            entityId,
            fieldId: { notIn: submittedFieldIds },
            value: null,
          },
        }),
      )
    }

    await Promise.all(ops)

    return NextResponse.json({ message: 'Custom field values saved' })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.flatten() }, { status: 400 })
    }
    console.error('[CUSTOM_FIELD_VALUES_POST]', error)
    return NextResponse.json({ error: 'Failed to save custom field values' }, { status: 500 })
  }
}
