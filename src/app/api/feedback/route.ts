import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission, getTenantFilter, getCreateBranchId } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── Constants ─────────────────────────────────────────────────────────────
const CATEGORIES = ['General', 'Service', 'Doctor', 'Facility', 'Billing', 'Wait Time'] as const
const STATUSES = ['New', 'Reviewed', 'Resolved', 'Dismissed'] as const

// ── Schemas ──────────────────────────────────────────────────────────────
const createFeedbackSchema = z.object({
  patientId: z.string().trim().min(1, 'Patient ID is required'),
  visitId: z.string().trim().optional(),
  rating: z.number().int().min(1, 'Rating must be 1-5').max(5, 'Rating must be 1-5').default(3),
  category: z.enum(CATEGORIES).default('General'),
  comment: z.string().trim().max(2000).optional(),
})

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/feedback')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const rating = searchParams.get('rating')
    const patientId = searchParams.get('patientId')
    const search = searchParams.get('search')?.trim() || ''

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    if (status && !STATUSES.includes(status as typeof STATUSES[number])) {
      return NextResponse.json(
        { error: 'Invalid status filter', details: `Must be one of: ${STATUSES.join(', ')}` },
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
    if (category) where.category = category
    if (rating) where.rating = parseInt(rating, 10)
    if (patientId) where.patientId = patientId
    if (search) {
      where.comment = { contains: search }
    }

    const [feedbacks, total] = await Promise.all([
      db.patientFeedback.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: {
            select: { id: true, patientId: true, name: true, phone: true },
          },
        },
      }),
      db.patientFeedback.count({ where }),
    ])

    return NextResponse.json({
      data: feedbacks,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[FEEDBACK_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch feedback', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── POST ─────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/feedback')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createFeedbackSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data
    const createBranchId = getCreateBranchId(auth.role, auth.branchId, request, body.branchId)

    // Auto-generate feedbackId
    const lastFeedback = await db.patientFeedback.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { feedbackId: true },
    })
    const lastNum = lastFeedback?.feedbackId ? parseInt(lastFeedback.feedbackId.replace('FB-', ''), 10) : 0
    const feedbackId = `FB-${String(lastNum + 1).padStart(4, '0')}`

    const feedback = await db.patientFeedback.create({
      data: {
        feedbackId,
        patientId: data.patientId,
        visitId: data.visitId,
        rating: data.rating,
        category: data.category,
        comment: data.comment,
        branchId: createBranchId,
      },
      include: {
        patient: {
          select: { id: true, patientId: true, name: true, phone: true },
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
      module: 'feedback',
      details: { feedbackId, rating: data.rating, category: data.category },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    })

    return NextResponse.json({ data: feedback }, { status: 201 })
  } catch (error) {
    console.error('[FEEDBACK_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create feedback', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
