import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission, getTenantFilter, getCreateBranchId } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── Constants ─────────────────────────────────────────────────────────────
const STATUSES = ['Pending', 'Accepted', 'Completed', 'Cancelled'] as const

// ── Schemas ──────────────────────────────────────────────────────────────
const createReferralSchema = z.object({
  patientId: z.string().trim().min(1, 'Patient ID is required'),
  fromDoctorId: z.string().trim().min(1, 'Referring doctor ID is required'),
  toDoctorId: z.string().trim().optional(),
  toExternalDoctor: z.string().trim().max(200).optional(),
  department: z.string().trim().max(100).optional(),
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(2000),
  notes: z.string().trim().max(2000).optional(),
})

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/referrals')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const status = searchParams.get('status')
    const patientId = searchParams.get('patientId')
    const fromDoctorId = searchParams.get('fromDoctorId')
    const department = searchParams.get('department')
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

    const tenantFilter = getTenantFilter(auth.role, auth.branchId, request)

    const where: Record<string, unknown> = { ...tenantFilter }
    if (status) where.status = status
    if (patientId) where.patientId = patientId
    if (fromDoctorId) where.fromDoctorId = fromDoctorId
    if (department) where.department = department
    if (search) {
      where.OR = [
        { reason: { contains: search } },
        { referralId: { contains: search } },
        { toExternalDoctor: { contains: search } },
      ]
    }

    const [referrals, total] = await Promise.all([
      db.referral.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: {
            select: { id: true, patientId: true, name: true, phone: true },
          },
          fromDoctor: {
            select: { id: true, doctorId: true, name: true, specialization: true },
          },
          toDoctor: {
            select: { id: true, doctorId: true, name: true, specialization: true },
          },
        },
      }),
      db.referral.count({ where }),
    ])

    return NextResponse.json({
      data: referrals,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[REFERRALS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch referrals', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── POST ─────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/referrals')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createReferralSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data
    const createBranchId = getCreateBranchId(auth.role, auth.branchId, request, body.branchId)

    // Auto-generate referralId
    const lastReferral = await db.referral.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { referralId: true },
    })
    const lastNum = lastReferral?.referralId ? parseInt(lastReferral.referralId.replace('REF-', ''), 10) : 0
    const referralId = `REF-${String(lastNum + 1).padStart(4, '0')}`

    const referral = await db.referral.create({
      data: {
        referralId,
        patientId: data.patientId,
        fromDoctorId: data.fromDoctorId,
        toDoctorId: data.toDoctorId,
        toExternalDoctor: data.toExternalDoctor,
        department: data.department,
        reason: data.reason,
        notes: data.notes,
        branchId: createBranchId,
      },
      include: {
        patient: {
          select: { id: true, patientId: true, name: true },
        },
        fromDoctor: {
          select: { id: true, doctorId: true, name: true },
        },
        toDoctor: {
          select: { id: true, doctorId: true, name: true },
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
      module: 'referrals',
      details: { referralId, patientId: data.patientId, department: data.department },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    })

    return NextResponse.json({ data: referral }, { status: 201 })
  } catch (error) {
    console.error('[REFERRALS_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create referral', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
