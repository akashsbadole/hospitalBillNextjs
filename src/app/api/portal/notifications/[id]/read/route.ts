import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request, '/api/portal')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    const notification = await db.portalNotification.findUnique({ where: { id } })
    if (!notification) return NextResponse.json({ error: 'Notification not found' }, { status: 404 })

    const updated = await db.portalNotification.update({
      where: { id },
      data: { read: true },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[PORTAL_NOTIFICATION_READ_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to mark notification as read', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
