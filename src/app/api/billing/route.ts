import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generateInvoiceNumber, calculateGST } from '@/lib/utils'
import { authenticateRequest, checkWritePermission, getTenantFilter, getCreateBranchId } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── Schemas ──────────────────────────────────────────────────────────────
const invoiceItemSchema = z.object({
  description: z.string().trim().min(1, 'Description is required').max(500),
  hsnCode: z.string().trim().optional(),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(10000),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
  gstRate: z.number().min(0).max(28).default(0),
  type: z.enum(['Service', 'Medicine', 'Lab Test', 'Room Charge', 'Package']).default('Service'),
})

const createInvoiceSchema = z.object({
  patientId: z.string().trim().min(1, 'Patient ID is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be YYYY-MM-DD').optional(),
  discount: z.number().min(0, 'Discount cannot be negative').default(0),
  discountType: z.enum(['flat', 'percentage']).default('flat'),
  roundOff: z.boolean().default(false),
  isInterstate: z.boolean().default(false),
  notes: z.string().trim().optional(),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required').max(100),
})

// ── Core calculation: consistent GST per-item + invoice totals ──────────
function calculateInvoiceTotals(
  items: Array<{ unitPrice: number; quantity: number; gstRate: number }>,
  isInterstate: boolean,
  discountValue: number,
  discountType: 'flat' | 'percentage',
  applyRoundOff: boolean,
) {
  let subtotal = 0
  let totalCgst = 0
  let totalSgst = 0
  let totalIgst = 0
  const itemCalcs: Array<{
    lineBase: number
    cgst: number
    sgst: number
    igst: number
    gstAmount: number
    total: number
  }> = []

  for (const item of items) {
    const lineBase = parseFloat((item.unitPrice * item.quantity).toFixed(2))
    subtotal += lineBase

    const gst = calculateGST(lineBase, item.gstRate, isInterstate)
    totalCgst += gst.cgst
    totalSgst += gst.sgst
    totalIgst += gst.igst
    itemCalcs.push({
      lineBase,
      cgst: gst.cgst,
      sgst: gst.sgst,
      igst: gst.igst,
      gstAmount: gst.totalGst,
      total: gst.grandTotal,
    })
  }

  subtotal = parseFloat(subtotal.toFixed(2))
  const totalGst = parseFloat((totalCgst + totalSgst + totalIgst).toFixed(2))
  const preDiscountTotal = parseFloat((subtotal + totalGst).toFixed(2))

  // Calculate effective discount
  let effectiveDiscount: number
  if (discountType === 'percentage') {
    effectiveDiscount = parseFloat((preDiscountTotal * discountValue / 100).toFixed(2))
  } else {
    effectiveDiscount = Math.min(discountValue, preDiscountTotal)
  }

  let afterDiscount = parseFloat((preDiscountTotal - effectiveDiscount).toFixed(2))

  // Round off to nearest rupee
  let roundOff = 0
  if (applyRoundOff) {
    const rounded = Math.round(afterDiscount)
    roundOff = parseFloat((rounded - afterDiscount).toFixed(2))
    afterDiscount = rounded
  }

  afterDiscount = Math.max(0, afterDiscount)

  return {
    subtotal,
    cgst: parseFloat(totalCgst.toFixed(2)),
    sgst: parseFloat(totalSgst.toFixed(2)),
    igst: parseFloat(totalIgst.toFixed(2)),
    totalGst,
    effectiveDiscount,
    roundOff,
    grandTotal: afterDiscount,
    itemCalcs,
  }
}

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/billing')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const search = searchParams.get('search')?.trim() || ''
    const status = searchParams.get('status')
    const patientId = searchParams.get('patientId')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    const validStatuses = ['Unpaid', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status filter', details: `Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    if (fromDate && !/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
      return NextResponse.json({ error: 'Invalid fromDate format', details: 'Must be YYYY-MM-DD' }, { status: 400 })
    }
    if (toDate && !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      return NextResponse.json({ error: 'Invalid toDate format', details: 'Must be YYYY-MM-DD' }, { status: 400 })
    }

    const where: Record<string, unknown> = { ...getTenantFilter(auth.role, auth.branchId, request) }

    if (status) where.status = status
    if (patientId) where.patientId = patientId
    if (fromDate || toDate) {
      const dateFilter: Record<string, unknown> = {}
      if (fromDate) dateFilter.gte = fromDate
      if (toDate) dateFilter.lte = toDate
      where.date = dateFilter
    }
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { patient: { name: { contains: search, mode: 'insensitive' } } },
        { patient: { patientId: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const [invoices, total] = await Promise.all([
      db.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          patient: { select: { id: true, patientId: true, name: true, phone: true } },
        },
      }),
      db.invoice.count({ where }),
    ])

    return NextResponse.json({
      data: invoices,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[BILLING_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoices', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── POST ─────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/billing')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()

    const parsed = createInvoiceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Check patient exists
    const patient = await db.patient.findUnique({ where: { id: data.patientId } })
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Validate percentage discount range
    if (data.discountType === 'percentage' && data.discount > 100) {
      return NextResponse.json(
        { error: 'Invalid discount', details: 'Percentage discount cannot exceed 100%' },
        { status: 400 }
      )
    }

    // Calculate everything in one consistent pass
    const calc = calculateInvoiceTotals(
      data.items,
      data.isInterstate,
      data.discount,
      data.discountType,
      data.roundOff,
    )

    if (calc.effectiveDiscount <= 0 && data.discount > 0) {
      return NextResponse.json(
        { error: 'Discount exceeds invoice total', details: 'Discount cannot be greater than the invoice total (subtotal + GST)' },
        { status: 400 }
      )
    }

    // Auto-generate invoice number
    const lastInvoice = await db.invoice.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { invoiceNumber: true },
    })
    const invoiceNumber = generateInvoiceNumber(lastInvoice?.invoiceNumber ?? null)

    // Build item data with consistent GST calculations
    const itemData = data.items.map((item, index) => {
      const ic = calc.itemCalcs[index]
      return {
        description: item.description,
        hsnCode: item.hsnCode ?? null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        gstRate: item.gstRate,
        gstAmount: ic.gstAmount,
        total: ic.total,
        type: item.type,
      }
    })

    const createBranchId = getCreateBranchId(auth.role, auth.branchId, request, body.branchId)
    // Create invoice with items in transaction
    const invoice = await db.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          invoiceNumber,
          patientId: data.patientId,
          date: data.date,
          dueDate: data.dueDate ?? null,
          subtotal: calc.subtotal,
          cgst: calc.cgst,
          sgst: calc.sgst,
          igst: calc.igst,
          totalGst: calc.totalGst,
          grandTotal: calc.grandTotal,
          discount: calc.effectiveDiscount,
          discountType: data.discountType,
          roundOff: calc.roundOff,
          paidAmount: 0,
          notes: data.notes ?? null,
          branchId: createBranchId,
          status: calc.grandTotal <= 0 ? 'Paid' : 'Unpaid',
          items: { create: itemData },
        },
        include: {
          patient: { select: { id: true, patientId: true, name: true, phone: true } },
          items: true,
        },
      })

      return created
    })

    logAudit({
      userId: auth.userId!,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'billing',
      details: {
        invoiceNumber: invoice.invoiceNumber,
        patientId: data.patientId,
        grandTotal: invoice.grandTotal,
        discountType: data.discountType,
        isInterstate: data.isInterstate,
        roundOff: calc.roundOff,
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: invoice }, { status: 201 })
  } catch (error) {
    console.error('[BILLING_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create invoice', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}