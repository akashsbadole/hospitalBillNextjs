import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── Schemas ──────────────────────────────────────────────────────────────
const updateInvoiceSchema = z.object({
  notes: z.string().trim().optional(),
  discount: z.number().min(0, 'Discount cannot be negative').optional(),
  discountType: z.enum(['flat', 'percentage']).optional(),
  roundOff: z.boolean().optional(),
  status: z.enum(['Unpaid', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled']).optional(),
})

// ── Recalculate invoice totals from items ───────────────────────────────
function recalcFromItems(
  subtotal: number,
  cgst: number,
  sgst: number,
  igst: number,
  totalGst: number,
  discountValue: number,
  discountType: string,
  applyRoundOff: boolean,
  paidAmount: number,
) {
  const preDiscountTotal = parseFloat((subtotal + totalGst).toFixed(2))

  let effectiveDiscount: number
  if (discountType === 'percentage') {
    effectiveDiscount = parseFloat((preDiscountTotal * discountValue / 100).toFixed(2))
  } else {
    effectiveDiscount = Math.min(discountValue, preDiscountTotal)
  }

  let afterDiscount = parseFloat((preDiscountTotal - effectiveDiscount).toFixed(2))

  let roundOff = 0
  if (applyRoundOff) {
    const rounded = Math.round(afterDiscount)
    roundOff = parseFloat((rounded - afterDiscount).toFixed(2))
    afterDiscount = rounded
  }

  afterDiscount = Math.max(0, afterDiscount)

  // Determine status
  let status: string
  if (afterDiscount <= 0) {
    status = 'Paid'
  } else if (paidAmount <= 0) {
    status = 'Unpaid'
  } else if (paidAmount >= afterDiscount) {
    status = 'Paid'
  } else {
    status = 'Partially Paid'
  }

  return {
    effectiveDiscount,
    roundOff,
    grandTotal: afterDiscount,
    status,
  }
}

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/billing')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 })
    }

    const invoice = await db.invoice.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, patientId: true, name: true, phone: true, email: true } },
        items: { orderBy: { id: 'asc' } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    return NextResponse.json({ data: invoice })
  } catch (error) {
    console.error('[INVOICE_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoice', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── PUT ──────────────────────────────────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/billing')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateInvoiceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const existing = await db.invoice.findUnique({
      where: { id },
      include: { payments: true, items: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Build update data
    const updateData: Record<string, unknown> = {}
    let needsRecalc = false
    let newDiscount = existing.discount
    let newDiscountType = existing.discountType || 'flat'
    let newRoundOff = existing.roundOff === 0 ? false : true

    if (data.notes !== undefined) updateData.notes = data.notes || null

    if (data.discount !== undefined) {
      if (data.discount < 0) {
        return NextResponse.json({ error: 'Discount cannot be negative' }, { status: 400 })
      }
      newDiscount = data.discount
      updateData.discount = data.discount
      needsRecalc = true
    }

    if (data.discountType !== undefined) {
      if (data.discountType === 'percentage' && newDiscount > 100) {
        return NextResponse.json(
          { error: 'Invalid discount', details: 'Percentage discount cannot exceed 100%' },
          { status: 400 }
        )
      }
      newDiscountType = data.discountType
      updateData.discountType = data.discountType
      needsRecalc = true
    }

    if (data.roundOff !== undefined) {
      newRoundOff = data.roundOff
      updateData.roundOff = 0 // will be recalculated
      needsRecalc = true
    }

    // Recalculate grandTotal if discount or roundOff changed
    if (needsRecalc) {
      const paidAmount = existing.payments
        .filter((p) => p.status === 'Success')
        .reduce((sum, p) => sum + p.amount, 0)

      const recalc = recalcFromItems(
        existing.subtotal,
        existing.cgst,
        existing.sgst,
        existing.igst,
        existing.totalGst,
        newDiscount,
        newDiscountType,
        newRoundOff,
        paidAmount,
      )

      if (recalc.effectiveDiscount <= 0 && newDiscount > 0) {
        return NextResponse.json({ error: 'Discount exceeds invoice total' }, { status: 400 })
      }

      updateData.discount = recalc.effectiveDiscount
      updateData.roundOff = recalc.roundOff
      updateData.grandTotal = recalc.grandTotal
      updateData.status = recalc.status
    }

    if (data.status !== undefined) {
      // Cannot set to Paid if paidAmount < grandTotal
      const currentGrandTotal = (updateData.grandTotal as number) ?? existing.grandTotal
      if (data.status === 'Paid' && existing.paidAmount < currentGrandTotal) {
        return NextResponse.json(
          { error: 'Cannot mark as Paid', details: 'Paid amount is less than the invoice total' },
          { status: 400 }
        )
      }
      updateData.status = data.status
    }

    const updated = await db.invoice.update({
      where: { id },
      data: updateData,
      include: {
        patient: { select: { id: true, patientId: true, name: true } },
        items: { orderBy: { id: 'asc' } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'UPDATE',
      module: 'billing',
      details: {
        invoiceId: id,
        invoiceNumber: updated.invoiceNumber,
        changedFields: Object.keys(data),
        ...(data.status ? { statusChange: `${existing.status} → ${data.status}` } : {}),
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[INVOICE_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update invoice', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── DELETE (soft delete → Cancelled) ────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/billing')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'DELETE')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 })
    }

    const existing = await db.invoice.findUnique({
      where: { id },
      include: { payments: { where: { status: 'Success' } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (existing.status === 'Cancelled') {
      return NextResponse.json({ error: 'Invoice is already cancelled' }, { status: 400 })
    }

    if (existing.payments.length > 0) {
      return NextResponse.json(
        { error: 'Cannot cancel invoice with successful payments', details: 'Refund all payments before cancelling' },
        { status: 400 }
      )
    }

    const invoice = await db.invoice.update({
      where: { id },
      data: { status: 'Cancelled' },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'DELETE',
      module: 'billing',
      details: { invoiceId: id, invoiceNumber: invoice.invoiceNumber, grandTotal: invoice.grandTotal },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: invoice })
  } catch (error) {
    console.error('[INVOICE_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to cancel invoice', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}