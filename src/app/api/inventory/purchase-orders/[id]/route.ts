import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const VALID_STATUSES = ['Draft', 'Submitted', 'Approved', 'Partially Received', 'Received', 'Cancelled']

const updatePOSchema = z.object({
  notes: z.string().optional(),
  status: z.string().optional(),
  expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected date must be YYYY-MM-DD').optional(),
})

// ── GET: PO Detail ─────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/inventory/purchase-orders')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { id } = await params
    const po = await db.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, supplierId: true, name: true, contact: true, email: true, address: true, gstin: true } },
        items: {
          include: { medicine: { select: { id: true, medicineId: true, name: true, category: true, manufacturer: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    if (!po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }
    return NextResponse.json({ data: po })
  } catch (error) {
    console.error('[PURCHASE_ORDER_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchase order', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── PUT: Update PO ─────────────────────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/inventory/purchase-orders')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    const body = await request.json()
    const parsed = updatePOSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await db.purchaseOrder.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (parsed.data.notes !== undefined) data.notes = parsed.data.notes
    if (parsed.data.expectedDate !== undefined) data.expectedDate = parsed.data.expectedDate
    if (parsed.data.status !== undefined) {
      if (!VALID_STATUSES.includes(parsed.data.status)) {
        return NextResponse.json(
          { error: 'Invalid status', details: `Must be one of: ${VALID_STATUSES.join(', ')}` },
          { status: 400 }
        )
      }
      data.status = parsed.data.status
    }

    const updated = await db.purchaseOrder.update({
      where: { id },
      data,
      include: {
        supplier: { select: { id: true, supplierId: true, name: true, contact: true, email: true } },
        items: { include: { medicine: { select: { id: true, medicineId: true, name: true } } } },
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'UPDATE',
      module: 'medicines',
      details: { poId: updated.poId, changes: data },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[PURCHASE_ORDER_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update purchase order', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── DELETE: Cancel PO (only if Draft) ──────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/inventory/purchase-orders')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'DELETE')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    const existing = await db.purchaseOrder.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }
    if (existing.status !== 'Draft') {
      return NextResponse.json(
        { error: 'Only Draft purchase orders can be cancelled', details: `Current status: ${existing.status}` },
        { status: 400 }
      )
    }

    const cancelled = await db.purchaseOrder.update({
      where: { id },
      data: { status: 'Cancelled' },
      include: {
        supplier: { select: { id: true, supplierId: true, name: true } },
        items: { include: { medicine: { select: { id: true, medicineId: true, name: true } } } },
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'DELETE',
      module: 'medicines',
      details: { poId: cancelled.poId, action: 'cancelled' },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: cancelled })
  } catch (error) {
    console.error('[PURCHASE_ORDER_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to cancel purchase order', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}