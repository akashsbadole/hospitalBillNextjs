import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'

const createFhirLogSchema = z.object({
  resourceType: z.string().trim().min(1, 'Resource type is required'),
  resourceId: z.string().trim().min(1, 'Resource ID is required'),
  patientId: z.string().optional(),
  operation: z.enum(['CREATE', 'UPDATE', 'DELETE', 'READ'], { message: 'Operation must be CREATE, UPDATE, DELETE, or READ' }),
  payload: z.string().trim().min(1, 'Payload is required'),
  status: z.string().default('Synced'),
  endpoint: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/settings')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const resourceType = searchParams.get('resourceType')
    const status = searchParams.get('status')

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (resourceType) where.resourceType = resourceType
    if (status) where.status = status

    const [logs, total] = await Promise.all([
      db.fhirResourceLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.fhirResourceLog.count({ where }),
    ])

    return NextResponse.json({ data: logs, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('[FHIR_LOG_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch FHIR logs', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/settings')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createFhirLogSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const log = await db.fhirResourceLog.create({
      data: {
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        patientId: data.patientId ?? null,
        operation: data.operation,
        payload: data.payload,
        status: data.status,
        endpoint: data.endpoint ?? null,
      },
    })

    return NextResponse.json({ data: log }, { status: 201 })
  } catch (error) {
    console.error('[FHIR_LOG_POST]', error)
    return NextResponse.json(
      { error: 'Failed to log FHIR operation', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
