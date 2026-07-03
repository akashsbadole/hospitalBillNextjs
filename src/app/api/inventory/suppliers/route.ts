import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { z } from 'zod'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const createSupplierSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  contact: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional(),
  gstin: z.string().optional(),
})

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

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/inventory/suppliers')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createSupplierSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const lastSupplier = await db.supplier.findFirst({ orderBy: { createdAt: 'desc' } })
    const lastId = lastSupplier?.supplierId ? parseInt(lastSupplier.supplierId.split('-')[1], 10) : 0
    const supplierId = `SUP-${String(lastId + 1).padStart(4, '0')}`

    const supplier = await db.supplier.create({
      data: {
        ...parsed.data,
        supplierId,
        email: parsed.data.email === '' ? null : parsed.data.email,
      },
    })

    logAudit({
      userId: auth.userId!,
      userName: auth.user!.name,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'inventory',
      details: { supplierId: supplier.id, supplierName: supplier.name },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: supplier }, { status: 201 })
  } catch (error) {
    console.error('[SUPPLIERS_POST]', error)
    return NextResponse.json({ error: 'Failed to create supplier' }, { status: 500 })
  }
}
