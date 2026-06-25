import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().optional(),
  subCategory: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  manufacturer: z.string().nullable().optional(),
  serialNumber: z.string().nullable().optional(),
  purchaseDate: z.string().nullable().optional(),
  purchaseCost: z.number().optional(),
  warrantyExpiry: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
  condition: z.string().optional(),
  status: z.string().optional(),
  notes: z.string().nullable().optional(),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request, '/api/assets')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    const asset = await db.asset.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        maintenanceRecords: {
          orderBy: { maintenanceDate: 'desc' },
        },
      },
    })
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    return NextResponse.json({ data: asset })
  } catch (error) {
    console.error('[ASSET_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch asset', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request, '/api/assets')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await db.asset.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

    const asset = await db.asset.update({ where: { id }, data: parsed.data })

    logAudit({
      userId: auth.userId!,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'UPDATE',
      module: 'inventory',
      details: { assetId: asset.assetId, name: asset.name },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: asset })
  } catch (error) {
    console.error('[ASSET_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update asset', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request, '/api/assets')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'DELETE')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    const existing = await db.asset.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

    await db.asset.delete({ where: { id } })

    logAudit({
      userId: auth.userId!,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'DELETE',
      module: 'inventory',
      details: { assetId: existing.assetId, name: existing.name },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: { id }, message: 'Asset deleted successfully' })
  } catch (error) {
    console.error('[ASSET_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete asset', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
