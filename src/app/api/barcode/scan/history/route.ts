import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest, getTenantFilter } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/barcode/scan/history')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const tenantFilter = getTenantFilter(auth.role, auth.branchId, request)

    const scans = await db.barcodeScan.findMany({
      where: tenantFilter,
      orderBy: { scannedAt: 'desc' },
      take: 50,
      include: {
        user: { select: { name: true, email: true } },
      },
    })

    return NextResponse.json({ data: scans })
  } catch (error) {
    console.error('[BARCODE_SCAN_HISTORY_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch scan history', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
