import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const updateSchema = z.object({
  maintenanceDate: z.string().optional(),
  type: z.enum(['Preventive', 'Corrective', 'Calibration', 'AMC']).optional(),
  description: z.string().nullable().optional(),
  cost: z.number().optional(),
  performedBy: z.string().nullable().optional(),
  nextDueDate: z.string().nullable().optional(),
  status: z.string().optional(),
  notes: z.string().nullable().optional(),
})

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

    const existing = await db.assetMaintenance.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Maintenance record not found' }, { status: 404 })

    const record = await db.assetMaintenance.update({ where: { id }, data: parsed.data })

    logAudit({
      userId: auth.userId!,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'UPDATE',
      module: 'inventory',
      details: { maintenanceId: record.id, assetId: record.assetId, type: record.type },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: record })
  } catch (error) {
    console.error('[ASSET_MAINTENANCE_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update maintenance record', details: error instanceof Error ? error.message : 'Unknown error' },
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
    const existing = await db.assetMaintenance.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Maintenance record not found' }, { status: 404 })

    await db.assetMaintenance.delete({ where: { id } })

    logAudit({
      userId: auth.userId!,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'DELETE',
      module: 'inventory',
      details: { maintenanceId: existing.id, assetId: existing.assetId },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: { id }, message: 'Maintenance record deleted successfully' })
  } catch (error) {
    console.error('[ASSET_MAINTENANCE_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete maintenance record', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
