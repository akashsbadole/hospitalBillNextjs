import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission, getTenantFilter, getCreateBranchId } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as const

const createDonorSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  phone: z.string().trim().min(1, 'Phone is required').max(20),
  email: z.string().email().optional().or(z.literal('')),
  bloodGroup: z.enum(BLOOD_GROUPS),
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  weight: z.number().min(1).max(300).optional(),
  medicalNotes: z.string().trim().max(2000).optional(),
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
    const search = searchParams.get('search')

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    const tenantFilter = getTenantFilter(auth.role, auth.branchId, request)

    const where: Record<string, unknown> = { ...tenantFilter }
    if (status) where.status = status
    if (bloodGroup) where.bloodGroup = bloodGroup
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [donors, total] = await Promise.all([
      db.bloodDonor.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { donations: true } } },
      }),
      db.bloodDonor.count({ where }),
    ])

    return NextResponse.json({
      data: donors,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[BLOOD_DONORS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch donors', details: error instanceof Error ? error.message : 'Unknown error' },
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
    const parsed = createDonorSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data
    const createBranchId = getCreateBranchId(auth.role, auth.branchId, request, body.branchId)

    const lastDonor = await db.bloodDonor.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { donorId: true },
    })
    const lastNum = lastDonor?.donorId ? parseInt(lastDonor.donorId.replace('DON-', ''), 10) : 0
    const donorId = `DON-${String(lastNum + 1).padStart(4, '0')}`

    const donor = await db.bloodDonor.create({
      data: {
        donorId,
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        bloodGroup: data.bloodGroup,
        gender: data.gender || null,
        dateOfBirth: data.dateOfBirth || null,
        weight: data.weight || null,
        medicalNotes: data.medicalNotes || null,
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
      details: { donorId, name: data.name, bloodGroup: data.bloodGroup },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: donor }, { status: 201 })
  } catch (error) {
    console.error('[BLOOD_DONORS_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create donor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
