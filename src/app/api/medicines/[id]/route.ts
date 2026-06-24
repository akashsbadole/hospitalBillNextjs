import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── Schemas ──────────────────────────────────────────────────────────────
const updateMedicineSchema = z.object({
  name: z.string().trim().min(1).max(300).optional(),
  category: z.string().trim().optional(),
  manufacturer: z.string().trim().optional(),
  batchNumber: z.string().trim().optional(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry date must be YYYY-MM-DD').optional(),
  purchasePrice: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  stock: z.number().int().min(0).optional(),
  minStock: z.number().int().min(0).optional(),
  gstRate: z.number().min(0).max(28).optional(),
  hsnCode: z.string().trim().optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
})

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/medicines')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Medicine ID is required' }, { status: 400 })
    }

    const medicine = await db.medicine.findUnique({
      where: { id },
    })

    if (!medicine) {
      return NextResponse.json({ error: 'Medicine not found' }, { status: 404 })
    }

    // Add computed stock status
    const stockStatus = medicine.stock <= 0
      ? 'Out of Stock'
      : medicine.stock <= medicine.minStock
        ? 'Low Stock'
        : 'In Stock'

    return NextResponse.json({ data: { ...medicine, stockStatus } })
  } catch (error) {
    console.error('[MEDICINE_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch medicine', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── PUT ──────────────────────────────────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/medicines')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Medicine ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateMedicineSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const existing = await db.medicine.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Medicine not found' }, { status: 404 })
    }

    const updated = await db.medicine.update({
      where: { id },
      data,
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'UPDATE',
      module: 'medicines',
      details: { medicineId: id, name: updated.name, changedFields: Object.keys(data) },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[MEDICINE_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update medicine', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── DELETE (soft delete → Inactive) ─────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/medicines')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'DELETE')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Medicine ID is required' }, { status: 400 })
    }

    const existing = await db.medicine.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Medicine not found' }, { status: 404 })
    }

    if (existing.status === 'Inactive') {
      return NextResponse.json({ error: 'Medicine is already inactive' }, { status: 400 })
    }

    const medicine = await db.medicine.update({
      where: { id },
      data: { status: 'Inactive' },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'DELETE',
      module: 'medicines',
      details: { medicineId: id, name: medicine.name },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: medicine })
  } catch (error) {
    console.error('[MEDICINE_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to deactivate medicine', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
