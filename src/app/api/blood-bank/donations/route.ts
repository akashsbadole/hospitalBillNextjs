import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission, getTenantFilter, getCreateBranchId } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as const
const DONATION_STATUSES = ['Donated', 'Screened', 'Quarantined', 'Approved', 'Discarded', 'Used'] as const

const recordDonationSchema = z.object({
  donorId: z.string().min(1, 'Donor ID is required'),
  bloodGroup: z.enum(BLOOD_GROUPS),
  quantity: z.number().min(50).max(500).default(350),
  hemoglobin: z.number().min(0).max(25).optional(),
  bloodPressure: z.string().optional(),
  pulse: z.string().optional(),
  temperature: z.string().optional(),
  bloodBagId: z.string().trim().max(100).optional(),
  testResults: z.string().optional(),
  status: z.enum(DONATION_STATUSES).default('Donated'),
  expiryDate: z.string().optional(),
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
    const donorId = searchParams.get('donorId')

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    const tenantFilter = getTenantFilter(auth.role, auth.branchId, request)

    const where: Record<string, unknown> = { ...tenantFilter }
    if (status) where.status = status
    if (bloodGroup) where.bloodGroup = bloodGroup
    if (donorId) where.donorId = donorId

    const [donations, total] = await Promise.all([
      db.bloodDonation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { donationDate: 'desc' },
        include: {
          donor: { select: { id: true, donorId: true, name: true, bloodGroup: true, phone: true } },
        },
      }),
      db.bloodDonation.count({ where }),
    ])

    // Summary stats
    const stats = await db.bloodDonation.aggregate({
      where: { ...tenantFilter },
      _sum: { quantity: true },
      _count: true,
    })

    return NextResponse.json({
      data: donations,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats: {
        totalQuantity: stats._sum.quantity || 0,
        totalCount: stats._count,
      },
    })
  } catch (error) {
    console.error('[BLOOD_DONATIONS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch donations', details: error instanceof Error ? error.message : 'Unknown error' },
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
    const parsed = recordDonationSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data
    const createBranchId = getCreateBranchId(auth.role, auth.branchId, request, body.branchId)

    const lastDona = await db.bloodDonation.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { donationId: true },
    })
    const lastNum = lastDona?.donationId ? parseInt(lastDona.donationId.replace('DONA-', ''), 10) : 0
    const donationId = `DONA-${String(lastNum + 1).padStart(4, '0')}`

    const donation = await db.bloodDonation.create({
      data: {
        donationId,
        donorId: data.donorId,
        bloodGroup: data.bloodGroup,
        quantity: data.quantity,
        hemoglobin: data.hemoglobin || null,
        bloodPressure: data.bloodPressure || null,
        pulse: data.pulse || null,
        temperature: data.temperature || null,
        bloodBagId: data.bloodBagId || null,
        testResults: data.testResults || null,
        status: data.status,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        branchId: createBranchId,
      },
    })

    // Update donor's lastDonation and totalDonations
    await db.bloodDonor.update({
      where: { id: data.donorId },
      data: {
        lastDonation: new Date(),
        totalDonations: { increment: 1 },
      },
    })

    // Add to inventory (if Approved status)
    if (data.status === 'Approved') {
      await db.bloodInventory.upsert({
        where: { bloodGroup: data.bloodGroup },
        update: { unitsAvailable: { increment: 1 } },
        create: {
          bloodGroup: data.bloodGroup,
          unitsAvailable: 1,
          minStock: 5,
        },
      })
    }

    logAudit({
      userId: auth.userId!,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'blood-bank',
      details: { donationId, bloodGroup: data.bloodGroup, quantity: data.quantity },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: donation }, { status: 201 })
  } catch (error) {
    console.error('[BLOOD_DONATIONS_POST]', error)
    return NextResponse.json(
      { error: 'Failed to record donation', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
