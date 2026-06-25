import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generateHl7MessageId } from '@/lib/utils'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'

const createHl7LogSchema = z.object({
  direction: z.enum(['Inbound', 'Outbound'], { message: 'Direction must be Inbound or Outbound' }),
  messageType: z.string().trim().min(1, 'Message type is required'),
  triggerEvent: z.string().optional(),
  patientId: z.string().optional(),
  content: z.string().trim().min(1, 'Content is required'),
  parsedData: z.string().optional(),
  status: z.string().default('Processed'),
  endpoint: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/settings')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const direction = searchParams.get('direction')
    const messageType = searchParams.get('messageType')
    const status = searchParams.get('status')

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (direction) where.direction = direction
    if (messageType) where.messageType = messageType
    if (status) where.status = status

    const [messages, total] = await Promise.all([
      db.hl7MessageLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.hl7MessageLog.count({ where }),
    ])

    return NextResponse.json({ data: messages, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('[HL7_LOG_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch HL7 messages', details: error instanceof Error ? error.message : 'Unknown error' },
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
    const parsed = createHl7LogSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const lastMessage = await db.hl7MessageLog.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { messageId: true },
    })
    const messageId = generateHl7MessageId(lastMessage?.messageId ?? null)

    const log = await db.hl7MessageLog.create({
      data: {
        messageId,
        direction: data.direction,
        messageType: data.messageType,
        triggerEvent: data.triggerEvent ?? null,
        patientId: data.patientId ?? null,
        content: data.content,
        parsedData: data.parsedData ?? null,
        status: data.status,
        endpoint: data.endpoint ?? null,
      },
    })

    return NextResponse.json({ data: log }, { status: 201 })
  } catch (error) {
    console.error('[HL7_LOG_POST]', error)
    return NextResponse.json(
      { error: 'Failed to log HL7 message', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
