import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission, getTenantFilter, getCreateBranchId } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'
import { generateQueueTokenId } from '@/lib/utils'

const createTokenSchema = z.object({
  patientId: z.string().min(1, 'Patient is required'),
  department: z.string().min(1, 'Department is required'),
  priority: z.enum(['Normal', 'Urgent', 'Emergency', 'VIP']).optional().default('Normal'),
  visitId: z.string().optional(),
  counterNumber: z.string().optional(),
})

const VALID_STATUSES = ['Waiting', 'Called', 'In-Consultation', 'Completed', 'Skipped'] as const
const VALID_PRIORITIES = ['Normal', 'Urgent', 'Emergency', 'VIP'] as const

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/queue')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const department = searchParams.get('department')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const search = searchParams.get('search')?.trim() || ''

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 50 : Math.min(200, Math.max(1, parseInt(rawLimit || '50', 10)))
    const skip = (page - 1) * limit

    if (status && !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      return NextResponse.json(
        { error: 'Invalid status filter', details: `Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    if (priority && !VALID_PRIORITIES.includes(priority as typeof VALID_PRIORITIES[number])) {
      return NextResponse.json(
        { error: 'Invalid priority filter', details: `Must be one of: ${VALID_PRIORITIES.join(', ')}` },
        { status: 400 }
      )
    }

    const tenantFilter = getTenantFilter(auth.role, auth.branchId, request)
    const where: Record<string, unknown> = { ...tenantFilter }
    if (department) where.department = department
    if (status) where.status = status
    if (priority) where.priority = priority

    if (search) {
      where.patient = {
        OR: [
          { name: { contains: search } },
          { phone: { contains: search } },
          { patientId: { contains: search } },
        ],
      }
    }

    const [tokens, total] = await Promise.all([
      db.queueToken.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ status: 'asc' }, { priority: 'desc' }, { tokenNumber: 'asc' }],
        include: {
          patient: {
            select: { id: true, patientId: true, name: true, phone: true, gender: true, bloodGroup: true },
          },
          visit: {
            select: { id: true, visitId: true, stage: true },
          },
        },
      }),
      db.queueToken.count({ where }),
    ])

    return NextResponse.json({
      data: tokens,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[QUEUE_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch queue', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/queue')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createTokenSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const patient = await db.patient.findUnique({ where: { id: data.patientId } })
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const lastTokenToday = await db.queueToken.findFirst({
      where: {
        department: data.department,
        issuedAt: { gte: today, lt: tomorrow },
      },
      orderBy: { tokenNumber: 'desc' },
      select: { tokenNumber: true },
    })

    const tokenNumber = (lastTokenToday?.tokenNumber ?? 0) + 1

    const lastToken = await db.queueToken.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { tokenId: true },
    })
    const tokenId = generateQueueTokenId(lastToken?.tokenId ?? null)

    const createBranchId = getCreateBranchId(auth.role, auth.branchId, request, body.branchId)
    const token = await db.queueToken.create({
      data: {
        tokenId,
        patientId: data.patientId,
        department: data.department,
        tokenNumber,
        priority: data.priority,
        status: 'Waiting',
        visitId: data.visitId || null,
        counterNumber: data.counterNumber || null,
        branchId: createBranchId,
      },
      include: {
        patient: {
          select: { id: true, patientId: true, name: true, phone: true },
        },
      },
    })

    logAudit({
      userId: auth.userId!,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'queue',
      details: { tokenId: token.tokenId, tokenNumber: token.tokenNumber, department: token.department, patientId: data.patientId },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: token }, { status: 201 })
  } catch (error) {
    console.error('[QUEUE_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create token', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
