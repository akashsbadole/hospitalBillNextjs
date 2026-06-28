import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generateScanId } from '@/lib/utils'
import { authenticateRequest, getCreateBranchId } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const scanSchema = z.object({
  barcode: z.string().trim().min(1, 'Barcode is required'),
  entityType: z.enum(['Medicine', 'Patient', 'Invoice', 'Equipment', 'Asset', 'BloodBag']),
  entityId: z.string().trim().min(1, 'Entity ID is required'),
  location: z.string().trim().optional(),
})

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/barcode/scan')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const body = await request.json()
    const parsed = scanSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data
    const branchId = getCreateBranchId(auth.role, auth.branchId, request)

    const lastScan = await db.barcodeScan.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { scanId: true },
    })
    const scanId = generateScanId(lastScan?.scanId ?? null)

    const scan = await db.barcodeScan.create({
      data: {
        scanId,
        barcode: data.barcode,
        entityType: data.entityType,
        entityId: data.entityId,
        location: data.location ?? null,
        scannedById: auth.user!.id,
        branchId: branchId,
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'barcode',
      details: { scanId: scan.scanId, barcode: data.barcode, entityType: data.entityType, entityId: data.entityId },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: scan }, { status: 201 })
  } catch (error) {
    console.error('[BARCODE_SCAN_POST]', error)
    return NextResponse.json(
      { error: 'Failed to record scan', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
