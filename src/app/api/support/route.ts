import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generateSupportTicketId } from '@/lib/utils'
import { authenticateRequest, checkWritePermission, getTenantFilter, getCreateBranchId } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── Constants ─────────────────────────────────────────────────────────────
const CATEGORIES = ['General', 'Billing', 'Technical', 'Appointment', 'Prescription', 'Inventory', 'Account', 'Other'] as const
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const
const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'] as const

// ── Schemas ──────────────────────────────────────────────────────────────
const createTicketSchema = z.object({
  subject: z.string().trim().min(3, 'Subject must be at least 3 characters').max(200),
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(5000),
  category: z.enum(CATEGORIES).default('General'),
  priority: z.enum(PRIORITIES).default('Medium'),
})

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/support')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const category = searchParams.get('category')
    const search = searchParams.get('search')?.trim() || ''
    const assignedToId = searchParams.get('assignedToId')

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    if (status && !STATUSES.includes(status as typeof STATUSES[number])) {
      return NextResponse.json(
        { error: 'Invalid status filter', details: `Must be one of: ${STATUSES.join(', ')}` },
        { status: 400 }
      )
    }
    if (priority && !PRIORITIES.includes(priority as typeof PRIORITIES[number])) {
      return NextResponse.json(
        { error: 'Invalid priority filter', details: `Must be one of: ${PRIORITIES.join(', ')}` },
        { status: 400 }
      )
    }
    if (category && !CATEGORIES.includes(category as typeof CATEGORIES[number])) {
      return NextResponse.json(
        { error: 'Invalid category filter', details: `Must be one of: ${CATEGORIES.join(', ')}` },
        { status: 400 }
      )
    }

    const tenantFilter = getTenantFilter(auth.role, auth.branchId, request)

    const where: Record<string, unknown> = { ...tenantFilter }
    if (status) where.status = status
    if (priority) where.priority = priority
    if (category) where.category = category
    if (assignedToId) where.assignedToId = assignedToId
    if (search) {
      where.OR = [
        { subject: { contains: search } },
        { description: { contains: search } },
        { ticketId: { contains: search } },
      ]
    }

    const [tickets, total] = await Promise.all([
      db.supportTicket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true, role: true },
          },
          assignedTo: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      }),
      db.supportTicket.count({ where }),
    ])

    return NextResponse.json({
      data: tickets,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[SUPPORT_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch support tickets', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── POST ─────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/support')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createTicketSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Auto-generate ticketId
    const lastTicket = await db.supportTicket.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { ticketId: true },
    })
    const ticketId = generateSupportTicketId(lastTicket?.ticketId ?? null)

    const createBranchId = getCreateBranchId(auth.role, auth.branchId, request, body.branchId)

    const ticket = await db.supportTicket.create({
      data: {
        ticketId,
        subject: data.subject,
        description: data.description,
        category: data.category,
        priority: data.priority,
        status: 'Open',
        createdById: auth.userId!,
        branchId: createBranchId,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    })

    // Audit log
    const reqInfo = extractRequestInfo(request)
    logAudit({
      userId: auth.userId!,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'support',
      details: { ticketId, subject: data.subject, category: data.category, priority: data.priority },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    })

    return NextResponse.json({ data: ticket }, { status: 201 })
  } catch (error) {
    console.error('[SUPPORT_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create support ticket', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
