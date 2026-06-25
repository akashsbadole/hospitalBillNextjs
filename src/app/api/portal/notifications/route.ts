import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'

const createSchema = z.object({
  patientId: z.string().min(1, 'Patient is required'),
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().min(1, 'Type is required'),
  link: z.string().optional(),
  linkId: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/portal')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const patientId = searchParams.get('patientId')

    if (!patientId) {
      return NextResponse.json({ error: 'patientId query parameter is required' }, { status: 400 })
    }

    const notifications = await db.portalNotification.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const unreadCount = await db.portalNotification.count({
      where: { patientId, read: false },
    })

    return NextResponse.json({ data: notifications, unreadCount })
  } catch (error) {
    console.error('[PORTAL_NOTIFICATIONS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch notifications', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/portal')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const patient = await db.patient.findUnique({ where: { id: data.patientId } })
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

    const notification = await db.portalNotification.create({
      data: {
        patientId: data.patientId,
        title: data.title,
        message: data.message,
        type: data.type,
        link: data.link ?? null,
        linkId: data.linkId ?? null,
      },
    })

    return NextResponse.json({ data: notification }, { status: 201 })
  } catch (error) {
    console.error('[PORTAL_NOTIFICATIONS_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create notification', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
