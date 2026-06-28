import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const createSchema = z.object({
  assetId: z.string().min(1, 'Asset is required'),
  maintenanceDate: z.string().min(1, 'Maintenance date is required'),
  type: z.enum(['Preventive', 'Corrective', 'Calibration', 'AMC']),
  description: z.string().optional(),
  cost: z.number().optional(),
  performedBy: z.string().optional(),
  nextDueDate: z.string().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/assets')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const assetId = searchParams.get('assetId')
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (assetId) where.assetId = assetId
    if (status) where.status = status

    const records = await db.assetMaintenance.findMany({
      where,
      orderBy: { maintenanceDate: 'desc' },
      include: {
        asset: { select: { id: true, assetId: true, name: true, category: true } },
      },
    })

    return NextResponse.json({ data: records })
  } catch (error) {
    console.error('[ASSET_MAINTENANCE_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch maintenance records', details: error instanceof Error ? error.message : 'Unknown error' },
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

    const asset = await db.asset.findUnique({ where: { id: data.assetId } })
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

    const record = await db.assetMaintenance.create({
      data: {
        assetId: data.assetId,
        maintenanceDate: data.maintenanceDate,
        type: data.type,
        description: data.description ?? null,
        cost: data.cost ?? 0,
        performedBy: data.performedBy ?? null,
        nextDueDate: data.nextDueDate ?? null,
        status: data.status ?? 'Scheduled',
        notes: data.notes ?? null,
      },
      include: {
        asset: { select: { id: true, assetId: true, name: true } },
      },
    })

    logAudit({
      userId: auth.userId!,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'inventory',
      details: { maintenanceId: record.id, assetId: data.assetId, type: data.type },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: record }, { status: 201 })
  } catch (error) {
    console.error('[ASSET_MAINTENANCE_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create maintenance record', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
