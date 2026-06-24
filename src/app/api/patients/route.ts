import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generatePatientId } from '@/lib/utils'
import { authenticateRequest, checkWritePermission, getTenantFilter, getCreateBranchId } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── Schemas ──────────────────────────────────────────────────────────────
const createPatientSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().trim().min(1, 'Phone is required').max(20),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['Male', 'Female', 'Other']).optional(),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']).optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  pincode: z.string().trim().max(10).optional(),
  aadhaarNumber: z.string().trim().max(12).optional(),
  emergencyContact: z.string().trim().optional(),
  emergencyPhone: z.string().trim().max(20).optional(),
  allergies: z.array(z.string()).optional(),
  pastTreatments: z.array(z.string()).optional(),
  insuranceProvider: z.string().trim().optional(),
  insuranceNumber: z.string().trim().optional(),
  maritalStatus: z.enum(['Single', 'Married', 'Divorced', 'Widowed']).optional(),
  occupation: z.string().trim().optional(),
})

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/patients')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const search = searchParams.get('search')?.trim() || ''
    const status = searchParams.get('status')
    const gender = searchParams.get('gender')
    const bloodGroup = searchParams.get('bloodGroup')
    const insurance = searchParams.get('insurance')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    const validStatuses = ['Active', 'Inactive', 'Archived']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status filter', details: `Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const validGenders = ['Male', 'Female', 'Other']
    if (gender && !validGenders.includes(gender)) {
      return NextResponse.json(
        { error: 'Invalid gender filter', details: `Must be one of: ${validGenders.join(', ')}` },
        { status: 400 }
      )
    }

    const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']
    if (bloodGroup && !validBloodGroups.includes(bloodGroup)) {
      return NextResponse.json(
        { error: 'Invalid blood group filter', details: `Must be one of: ${validBloodGroups.join(', ')}` },
        { status: 400 }
      )
    }

    const validInsurance = ['Insured', 'Uninsured']
    if (insurance && !validInsurance.includes(insurance)) {
      return NextResponse.json(
        { error: 'Invalid insurance filter', details: `Must be one of: ${validInsurance.join(', ')}` },
        { status: 400 }
      )
    }

    const tenantFilter = getTenantFilter(auth.role, auth.branchId, request)
    const where: Record<string, unknown> = { ...tenantFilter }
    if (status) where.status = status
    if (gender) where.gender = gender
    if (bloodGroup) where.bloodGroup = bloodGroup
    if (insurance === 'Insured') where.insuranceProvider = { not: null }
    if (insurance === 'Uninsured') where.insuranceProvider = null

    // Date range filters on createdAt
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {}
      if (dateFrom) dateFilter.gte = new Date(dateFrom)
      if (dateTo) {
        const toDate = new Date(dateTo)
        toDate.setHours(23, 59, 59, 999)
        dateFilter.lte = toDate
      }
      where.createdAt = dateFilter
    }

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
        { patientId: { contains: search } },
      ]
    }

    const [patients, total] = await Promise.all([
      db.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.patient.count({ where }),
    ])

    return NextResponse.json({
      data: patients,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[PATIENTS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch patients', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── POST ─────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/patients')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()

    const parsed = createPatientSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Auto-generate patientId
    const lastPatient = await db.patient.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { patientId: true },
    })
    const patientId = generatePatientId(lastPatient?.patientId ?? null)

    const createBranchId = getCreateBranchId(auth.role, auth.branchId, request, body.branchId)
    const patient = await db.patient.create({
      data: {
        ...data,
        email: data.email === '' ? null : data.email,
        allergies: data.allergies ? JSON.stringify(data.allergies) : null,
        pastTreatments: data.pastTreatments ? JSON.stringify(data.pastTreatments) : null,
        patientId,
        branchId: createBranchId,
      },
    })

    logAudit({
      userId: auth.userId!,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'patients',
      details: { patientId: patient.patientId, name: patient.name },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: patient }, { status: 201 })
  } catch (error) {
    console.error('[PATIENTS_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create patient', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
