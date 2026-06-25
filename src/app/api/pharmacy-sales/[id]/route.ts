import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const updatePharmacySaleSchema = z.object({
  status: z.enum(['Completed', 'Returned', 'Cancelled']).optional(),
  notes: z.string().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/pharmacy-sales')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Sale ID is required' }, { status: 400 })
    }

    const sale = await db.pharmacySale.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, patientId: true, name: true, phone: true } },
        items: {
          include: { medicine: { select: { id: true, medicineId: true, name: true, stock: true } } },
        },
      },
    })

    if (!sale) {
      return NextResponse.json({ error: 'Pharmacy sale not found' }, { status: 404 })
    }

    return NextResponse.json({ data: sale })
  } catch (error) {
    console.error('[PHARMACY_SALE_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch pharmacy sale', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/pharmacy-sales')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Sale ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updatePharmacySaleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await db.pharmacySale.findUnique({
      where: { id },
      include: { items: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Pharmacy sale not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes

    // Restore stock if cancelling/returning
    if (parsed.data.status === 'Cancelled' || parsed.data.status === 'Returned') {
      if (existing.status === 'Completed') {
        for (const item of existing.items) {
          if (item.medicineId) {
            await db.medicine.update({
              where: { id: item.medicineId },
              data: { stock: { increment: item.quantity } },
            })
            await db.stockMovement.create({
              data: {
                movementId: `SM-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                medicineId: item.medicineId,
                type: 'Return',
                quantity: item.quantity,
                referenceId: existing.saleId,
                notes: `Restored from ${parsed.data.status} sale ${existing.saleId}`,
              },
            })
          }
        }
      }
    }

    const updated = await db.pharmacySale.update({
      where: { id },
      data: updateData,
      include: {
        patient: { select: { id: true, patientId: true, name: true } },
        items: true,
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: existing.status !== updated.status ? 'STATUS_CHANGE' : 'UPDATE',
      module: 'patients',
      details: { saleId: existing.saleId, previousStatus: existing.status, newStatus: updated.status },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[PHARMACY_SALE_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update pharmacy sale', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/pharmacy-sales')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'DELETE')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Sale ID is required' }, { status: 400 })
    }

    const existing = await db.pharmacySale.findUnique({
      where: { id },
      include: { items: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Pharmacy sale not found' }, { status: 404 })
    }

    // Restore stock if deleting a completed sale
    if (existing.status === 'Completed') {
      for (const item of existing.items) {
        if (item.medicineId) {
          await db.medicine.update({
            where: { id: item.medicineId },
            data: { stock: { increment: item.quantity } },
          })
        }
      }
    }

    await db.pharmacySale.delete({ where: { id } })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'DELETE',
      module: 'patients',
      details: { saleId: existing.saleId, grandTotal: existing.grandTotal },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: { message: 'Pharmacy sale deleted successfully' } })
  } catch (error) {
    console.error('[PHARMACY_SALE_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete pharmacy sale', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
