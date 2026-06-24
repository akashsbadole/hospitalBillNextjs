import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── Schemas ──────────────────────────────────────────────────────────────
const createReplySchema = z.object({
  message: z.string().trim().min(1, 'Message is required').max(5000),
})

// Roles considered internal (admin/staff replies)
const INTERNAL_ROLES = ['Admin', 'Receptionist', 'Accountant']

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/support')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Ticket ID is required' }, { status: 400 })
    }

    // Verify ticket exists
    const ticket = await db.supportTicket.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!ticket) {
      return NextResponse.json({ error: 'Support ticket not found' }, { status: 404 })
    }

    const replies = await db.supportReply.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: replies })
  } catch (error) {
    console.error('[SUPPORT_REPLIES_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch replies', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── POST ─────────────────────────────────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/support')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Ticket ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = createReplySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    // Verify ticket exists
    const ticket = await db.supportTicket.findUnique({
      where: { id },
      select: { id: true, ticketId: true },
    })
    if (!ticket) {
      return NextResponse.json({ error: 'Support ticket not found' }, { status: 404 })
    }

    const isInternal = INTERNAL_ROLES.includes(auth.role!)

    const reply = await db.supportReply.create({
      data: {
        ticketId: id,
        userId: auth.user!.id,
        userName: auth.user!.email,
        userRole: auth.role!,
        message: parsed.data.message,
        isInternal,
      },
    })

    // Audit log
    const reqInfo = extractRequestInfo(request)
    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'support',
      details: {
        ticketId: ticket.ticketId,
        replyId: reply.id,
        messagePreview: parsed.data.message.substring(0, 100),
        isInternal,
      },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    })

    return NextResponse.json({ data: reply }, { status: 201 })
  } catch (error) {
    console.error('[SUPPORT_REPLIES_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create reply', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
