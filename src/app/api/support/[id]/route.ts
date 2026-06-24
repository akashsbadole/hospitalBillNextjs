import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── Constants ─────────────────────────────────────────────────────────────
const CATEGORIES = ['General', 'Billing', 'Technical', 'Appointment', 'Prescription', 'Inventory', 'Account', 'Other'] as const
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const
const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'] as const

// ── Schemas ──────────────────────────────────────────────────────────────
const updateTicketSchema = z.object({
  subject: z.string().trim().min(3, 'Subject must be at least 3 characters').max(200).optional(),
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(5000).optional(),
  status: z.enum(STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  category: z.enum(CATEGORIES).optional(),
  assignedToId: z.string().trim().min(1).nullable().optional(),
  resolution: z.string().trim().optional(),
})

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

    const ticket = await db.supportTicket.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true, role: true },
        },
        replies: {
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { replies: true },
        },
      },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Support ticket not found' }, { status: 404 })
    }

    return NextResponse.json({
      data: {
        ...ticket,
        replyCount: ticket._count.replies,
      },
    })
  } catch (error) {
    console.error('[SUPPORT_TICKET_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch support ticket', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── PUT ──────────────────────────────────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/support')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Ticket ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateTicketSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Verify ticket exists
    const existing = await db.supportTicket.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Support ticket not found' }, { status: 404 })
    }

    // Validate assignedToId if provided
    if (data.assignedToId) {
      const assignedUser = await db.user.findUnique({
        where: { id: data.assignedToId },
        select: { id: true, name: true },
      })
      if (!assignedUser) {
        return NextResponse.json({ error: 'Assigned user not found' }, { status: 400 })
      }
    }

    // If status is being set to Resolved, ensure assignedToId exists
    if (data.status === 'Resolved' && !existing.assignedToId && !data.assignedToId) {
      return NextResponse.json(
        { error: 'Cannot resolve ticket without an assignee. Please assign the ticket first.' },
        { status: 400 }
      )
    }

    // If status is being set to Resolved and no resolution provided, set a default
    const updateData: Record<string, unknown> = { ...data }
    if (data.status === 'Resolved' && !data.resolution && !existing.resolution) {
      updateData.resolution = 'Ticket resolved.'
    }

    const updatedTicket = await db.supportTicket.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    })

    // Audit log
    const reqInfo = extractRequestInfo(request)
    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'UPDATE',
      module: 'support',
      details: {
        ticketId: existing.ticketId,
        updatedFields: Object.keys(data),
        ...(data.status ? { statusChange: `${existing.status} → ${data.status}` } : {}),
      },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    })

    return NextResponse.json({ data: updatedTicket })
  } catch (error) {
    console.error('[SUPPORT_TICKET_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update support ticket', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── DELETE ───────────────────────────────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/support')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'DELETE')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  // Only Admin can delete support tickets
  if (auth.role !== 'Admin') {
    return NextResponse.json({ error: 'Only Admin can delete support tickets' }, { status: 403 })
  }

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Ticket ID is required' }, { status: 400 })
    }

    // Verify ticket exists
    const existing = await db.supportTicket.findUnique({
      where: { id },
      select: { id: true, ticketId: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Support ticket not found' }, { status: 404 })
    }

    // Delete ticket (cascade deletes replies)
    await db.supportTicket.delete({
      where: { id },
    })

    // Audit log
    const reqInfo = extractRequestInfo(request)
    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'DELETE',
      module: 'support',
      details: { ticketId: existing.ticketId },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    })

    return NextResponse.json({ data: { id, deleted: true } })
  } catch (error) {
    console.error('[SUPPORT_TICKET_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete support ticket', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
