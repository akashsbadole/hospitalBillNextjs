import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generateAssetId } from '@/lib/utils'
import { authenticateRequest, checkWritePermission, getTenantFilter, getCreateBranchId } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.string().min(1, 'Category is required'),
  subCategory: z.string().optional(),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  serialNumber: z.string().optional(),
  purchaseDate: z.string().optional(),
  purchaseCost: z.number().optional(),
  warrantyExpiry: z.string().optional(),
  location: z.string().optional(),
  assignedTo: z.string().optional(),
  condition: z.string().optional(),
  status: z.string().optional(),
  branchId: z.string().optional(),
  notes: z.string().optional(),
})

const VALID_CATEGORIES = ['Medical Equipment', 'Furniture', 'IT', 'Vehicle', 'Building', 'Instrument']

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/assets')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const category = searchParams.get('category')
    const status = searchParams.get('status')
    const branchId = searchParams.get('branchId')

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    if (category && !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: 'Invalid category filter', details: `Must be one of: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 }
      )
    }

    const tenantFilter = getTenantFilter(auth.role, auth.branchId, request)
    const where: Record<string, unknown> = { ...tenantFilter }
    if (category) where.category = category
    if (status) where.status = status
    if (branchId) where.branchId = branchId

    const [assets, total] = await Promise.all([
      db.asset.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          branch: { select: { id: true, name: true, code: true } },
          maintenanceRecords: { orderBy: { maintenanceDate: 'desc' }, take: 5 },
        },
      }),
      db.asset.count({ where }),
    ])

    return NextResponse.json({ data: assets, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('[ASSETS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch assets', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/assets')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const lastAsset = await db.asset.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { assetId: true },
    })
    const assetId = generateAssetId(lastAsset?.assetId ?? null)

    const createBranchId = getCreateBranchId(auth.role, auth.branchId, request, data.branchId)
    const asset = await db.asset.create({
      data: {
        assetId,
        name: data.name,
        category: data.category,
        subCategory: data.subCategory ?? null,
        model: data.model ?? null,
        manufacturer: data.manufacturer ?? null,
        serialNumber: data.serialNumber ?? null,
        purchaseDate: data.purchaseDate ?? null,
        purchaseCost: data.purchaseCost ?? 0,
        warrantyExpiry: data.warrantyExpiry ?? null,
        location: data.location ?? null,
        assignedTo: data.assignedTo ?? null,
        condition: data.condition ?? 'Good',
        status: data.status ?? 'Active',
        branchId: createBranchId,
        notes: data.notes ?? null,
      },
      include: {
        branch: { select: { id: true, name: true } },
      },
    })

    logAudit({
      userId: auth.userId!,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'inventory',
      details: { assetId: asset.assetId, name: asset.name, category: asset.category },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: asset }, { status: 201 })
  } catch (error) {
    console.error('[ASSETS_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create asset', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
