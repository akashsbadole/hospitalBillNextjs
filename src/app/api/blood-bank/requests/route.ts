import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission, getTenantFilter, getCreateBranchId } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as const
const URGENCIES = ['Normal', 'Urgent', 'Emergency'] as const
const CROSSMATCH_TYPES = ['Type & Screen', 'Type & Crossmatch'] as const

const createRequestSchema = z.object({
  patientId: z.string().min(1, 'Patient ID is required'),
  doctorId: z.string().min(1, 'Doctor ID is required'),
  bloodGroup: z.enum(BLOOD_GROUPS),
  unitsRequired: z.number().int().min(1, 'At least 1 unit required'),
  urgency: z.enum(URGENCIES).default('Normal'),
  reason: z.string().trim().max(2000).optional(),
  crossMatchType: z.enum(CROSSMATCH_TYPES).default('Type & Screen'),
  notes: z.string().trim().max(2000).optional(),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/blood-bank')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const status = searchParams.get('status')
    const bloodGroup = searchParams.get('bloodGroup')
    const urgency = searchParams.get('urgency')

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    const tenantFilter = getTenantFilter(auth.role, auth.branchId, request)

    const where: Record<string, unknown> = { ...tenantFilter }
    if (status) where.status = status
    if (bloodGroup) where.bloodGroup = bloodGroup
    if (urgency) where.urgency = urgency

    const [requests, total] = await Promise.all([
      db.bloodRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ urgency: 'desc' }, { createdAt: 'desc' }],
        include: {
          patient: { select: { id: true, patientId: true, name: true, bloodGroup: true } },
          doctor: { select: { id: true, doctorId: true, name: true, specialization: true } },
        },
      }),
      db.bloodRequest.count({ where }),
    ])

    return NextResponse.json({
      data: requests,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[BLOOD_REQUESTS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch requests', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/blood-bank')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data
    const createBranchId = getCreateBranchId(auth.role, auth.branchId, request, body.branchId)

    const lastReq = await db.bloodRequest.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { requestId: true },
    })
    const lastNum = lastReq?.requestId ? parseInt(lastReq.requestId.replace('BLDREQ-', ''), 10) : 0
    const requestId = `BLDREQ-${String(lastNum + 1).padStart(4, '0')}`

    const bloodRequest = await db.bloodRequest.create({
      data: {
        requestId,
        patientId: data.patientId,
        doctorId: data.doctorId,
        bloodGroup: data.bloodGroup,
        unitsRequired: data.unitsRequired,
        urgency: data.urgency,
        reason: data.reason || null,
        crossMatchType: data.crossMatchType,
        notes: data.notes || null,
        branchId: createBranchId,
      },
    })

    logAudit({
      userId: auth.userId!,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'blood-bank',
      details: { requestId, bloodGroup: data.bloodGroup, unitsRequired: data.unitsRequired, urgency: data.urgency },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: bloodRequest }, { status: 201 })
  } catch (error) {
    console.error('[BLOOD_REQUESTS_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create blood request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
