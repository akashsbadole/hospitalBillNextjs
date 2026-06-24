import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generateDoctorId } from '@/lib/utils'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── Schemas ──────────────────────────────────────────────────────────────
const createDoctorSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().trim().min(1, 'Phone is required').max(20),
  specialization: z.string().trim().min(1, 'Specialization is required').max(200),
  qualification: z.string().trim().optional(),
  experience: z.number().int().min(0).max(80).default(0),
  consultationFee: z.number().min(0).default(0),
  bio: z.string().trim().optional(),
  status: z.enum(['Active', 'Inactive']).default('Active'),
})

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/doctors')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const search = searchParams.get('search')?.trim() || ''
    const status = searchParams.get('status')

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    const validStatuses = ['Active', 'Inactive']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status filter', details: `Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { specialization: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { doctorId: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [doctors, total] = await Promise.all([
      db.doctor.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { appointments: true } },
        },
      }),
      db.doctor.count({ where }),
    ])

    return NextResponse.json({
      data: doctors,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[DOCTORS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch doctors', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── POST ─────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/doctors')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()

    const parsed = createDoctorSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Auto-generate doctorId
    const lastDoctor = await db.doctor.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { doctorId: true },
    })
    const doctorId = generateDoctorId(lastDoctor?.doctorId ?? null)

    const doctor = await db.doctor.create({
      data: {
        ...data,
        email: data.email === '' ? null : data.email,
        doctorId,
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'doctors',
      details: { doctorId: doctor.doctorId, name: doctor.name },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: doctor }, { status: 201 })
  } catch (error) {
    console.error('[DOCTORS_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create doctor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
