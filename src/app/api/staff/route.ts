import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generateStaffId } from '@/lib/utils'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── Schemas ──────────────────────────────────────────────────────────────
const VALID_ROLES = ['Admin', 'Receptionist', 'Doctor', 'Accountant', 'Pharmacist'] as const
const VALID_STATUSES = ['Active', 'Inactive'] as const

const staffIdSchema = z.object({
  id: z.string().trim().min(1, 'Staff ID is required'),
})

const createStaffSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().trim().min(1, 'Phone is required').max(20),
  role: z.enum(VALID_ROLES),
  status: z.enum(VALID_STATUSES).default('Active'),
})

const updateStaffSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().trim().min(1).max(20).optional(),
  role: z.enum(VALID_ROLES).optional(),
  status: z.enum(VALID_STATUSES).optional(),
})

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/staff')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const role = searchParams.get('role')
    const status = searchParams.get('status')
    const search = searchParams.get('search')?.trim() || ''

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    if (role && !VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
      return NextResponse.json(
        { error: 'Invalid role filter', details: `Must be one of: ${VALID_ROLES.join(', ')}` },
        { status: 400 }
      )
    }

    if (status && !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      return NextResponse.json(
        { error: 'Invalid status filter', details: `Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    const where: Record<string, unknown> = {}
    if (role) where.role = role
    if (status) where.status = status
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
        { staffId: { contains: search } },
      ]
    }

    const [staffList, total] = await Promise.all([
      db.staff.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.staff.count({ where }),
    ])

    return NextResponse.json({
      data: staffList,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[STAFF_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch staff', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── POST ─────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/staff')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()

    const parsed = createStaffSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Auto-generate staff ID
    const lastStaff = await db.staff.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { staffId: true },
    })
    const staffId = generateStaffId(lastStaff?.staffId ?? null)

    const staff = await db.staff.create({
      data: {
        ...data,
        email: data.email === '' ? null : data.email,
        staffId,
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'staff',
      details: { staffId: staff.id, staffIdDisplay: staffId, name: staff.name, role: staff.role },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: staff }, { status: 201 })
  } catch (error) {
    console.error('[STAFF_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create staff member', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── PUT ──────────────────────────────────────────────────────────────────
export async function PUT(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/staff')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()

    const parsed = updateStaffSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Require id for updates
    if (!body.id || (typeof body.id === 'string' && body.id.trim() === '')) {
      return NextResponse.json({ error: 'Staff ID is required for updates' }, { status: 400 })
    }

    const idSchema = staffIdSchema.safeParse({ id: body.id })
    if (!idSchema.success) {
      return NextResponse.json({ error: 'Invalid staff ID' }, { status: 400 })
    }

    const existing = await db.staff.findUnique({ where: { id: body.id } })
    if (!existing) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
    }

    const updated = await db.staff.update({
      where: { id: body.id },
      data: {
        ...data,
        email: data.email === '' ? null : data.email,
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'UPDATE',
      module: 'staff',
      details: { staffId: body.id, name: updated.name, changedFields: Object.keys(data) },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[STAFF_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update staff member', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── DELETE (soft delete → Inactive) ─────────────────────────────────────
export async function DELETE(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/staff')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'DELETE')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { searchParams } = request.nextUrl
    const id = searchParams.get('id')

    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Staff ID is required' }, { status: 400 })
    }

    const existing = await db.staff.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
    }

    if (existing.status === 'Inactive') {
      return NextResponse.json({ error: 'Staff member is already inactive' }, { status: 400 })
    }

    const staff = await db.staff.update({
      where: { id },
      data: { status: 'Inactive' },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'DELETE',
      module: 'staff',
      details: { staffId: id, name: staff.name, staffIdDisplay: existing.staffId },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: staff })
  } catch (error) {
    console.error('[STAFF_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to deactivate staff member', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
