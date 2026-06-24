import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generateBranchId } from '@/lib/utils'
import { authenticateRequest } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── Schemas ──────────────────────────────────────────────────────────────
const createBranchSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  code: z.string().trim().min(1, 'Code is required').max(20),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  pincode: z.string().trim().max(10).optional(),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  gstin: z.string().trim().max(15).optional(),
  isHead: z.boolean().optional(),
})

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/branches')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const search = searchParams.get('search')?.trim() || ''
    const status = searchParams.get('status')
    const all = searchParams.get('all') === 'true'

    if (all) {
      const where: Record<string, unknown> = {}
      if (status) Object.assign(where, { status })
      if (search) {
        Object.assign(where, {
          OR: [
            { name: { contains: search } },
            { code: { contains: search } },
            { city: { contains: search } },
            { branchId: { contains: search } },
          ],
        })
      }
      const branches = await db.branch.findMany({
        where,
        orderBy: [{ isHead: 'desc' }, { name: 'asc' }],
        select: {
          id: true,
          branchId: true,
          name: true,
          code: true,
          city: true,
          isHead: true,
          status: true,
        },
      })
      return NextResponse.json({ data: branches })
    }

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (status) Object.assign(where, { status })
    if (search) {
      Object.assign(where, {
        OR: [
          { name: { contains: search } },
          { code: { contains: search } },
          { city: { contains: search } },
          { branchId: { contains: search } },
        ],
      })
    }

    const [branches, total] = await Promise.all([
      db.branch.findMany({
        where,
        orderBy: [{ isHead: 'desc' }, { name: 'asc' }],
        skip,
        take: limit,
      }),
      db.branch.count({ where }),
    ])

    return NextResponse.json({
      data: branches,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[BRANCHES_GET]', error)
    return NextResponse.json({ error: 'Failed to fetch branches' }, { status: 500 })
  }
}

// ── POST ─────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/branches')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  if (auth.role !== 'Admin') {
    return NextResponse.json({ error: 'Only Admin can create branches' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const data = createBranchSchema.parse(body)

    // Check unique code
    const existingCode = await db.branch.findUnique({ where: { code: data.code } })
    if (existingCode) {
      return NextResponse.json({ error: `Branch code "${data.code}" already exists` }, { status: 409 })
    }

    // If isHead, unset other head branches
    if (data.isHead) {
      await db.branch.updateMany({ where: { isHead: true }, data: { isHead: false } })
    }

    // Generate branch ID
    const lastBranch = await db.branch.findFirst({
      orderBy: { branchId: 'desc' },
      select: { branchId: true },
    })
    const branchId = generateBranchId(lastBranch?.branchId || null)

    const branch = await db.branch.create({
      data: {
        branchId,
        name: data.name,
        code: data.code.toUpperCase(),
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        pincode: data.pincode || null,
        phone: data.phone || null,
        email: data.email || null,
        gstin: data.gstin || null,
        isHead: data.isHead || false,
      },
    })

    const reqInfo = extractRequestInfo(request)
    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'settings',
      details: { entity: 'Branch', branchId, name: data.name, code: data.code },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    })

    return NextResponse.json({ data: branch }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors = error.flatten().fieldErrors
      const firstMessage = Object.values(fieldErrors).flat()[0]
      return NextResponse.json({ error: 'Validation failed', details: firstMessage }, { status: 400 })
    }
    console.error('[BRANCHES_POST]', error)
    return NextResponse.json({ error: 'Failed to create branch' }, { status: 500 })
  }
}
