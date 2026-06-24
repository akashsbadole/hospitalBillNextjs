import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'

// ── GET: List Suppliers ───────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/inventory/suppliers')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const suppliers = await db.supplier.findMany({
      orderBy: { name: 'asc' },
    })
    return NextResponse.json({ data: suppliers })
  } catch (error) {
    console.error('[SUPPLIERS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch suppliers', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}