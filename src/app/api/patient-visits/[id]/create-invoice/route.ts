import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generateInvoiceNumber, calculateGST } from '@/lib/utils'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'
import { VISIT_STAGES } from '../../route'

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
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required').max(100),
  discount: z.number().min(0, 'Discount cannot be negative').default(0),
  discountType: z.enum(['flat', 'percentage']).default('flat'),
  roundOff: z.boolean().default(false),
  isInterstate: z.boolean().default(false),
  notes: z.string().trim().optional(),
})

// Helper: get stage index
function stageIndex(stage: string): number {
  return VISIT_STAGES.indexOf(stage as typeof VISIT_STAGES[number])
}

const PRESCRIBED_INDEX = stageIndex('Prescribed')
const BILLED_INDEX = stageIndex('Billed')

// ── Core calculation (same as billing route) ───────────────────────────
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
    cgst: number; sgst: number; igst: number
    gstAmount: number; total: number
  }> = []

  for (const item of items) {
    const lineBase = parseFloat((item.unitPrice * item.quantity).toFixed(2))
    subtotal += lineBase
    const gst = calculateGST(lineBase, item.gstRate, isInterstate)
    totalCgst += gst.cgst
    totalSgst += gst.sgst
    totalIgst += gst.igst
    itemCalcs.push({
      lineBase, cgst: gst.cgst, sgst: gst.sgst, igst: gst.igst,
      gstAmount: gst.totalGst, total: gst.grandTotal,
    })
  }

  subtotal = parseFloat(subtotal.toFixed(2))
  const totalGst = parseFloat((totalCgst + totalSgst + totalIgst).toFixed(2))
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

// ── POST ─────────────────────────────────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/patient-visits')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    const body = await request.json()

    const parsed = createInvoiceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Validate percentage discount
    if (data.discountType === 'percentage' && data.discount > 100) {
      return NextResponse.json(
        { error: 'Invalid discount', details: 'Percentage discount cannot exceed 100%' },
        { status: 400 }
      )
    }

    // Fetch visit with patient and stages
    const visit = await db.patientVisit.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, patientId: true, name: true, phone: true } },
        stages: { orderBy: { createdAt: 'asc' } },
      },
    })

    if (!visit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 })
    }

    if (visit.status !== 'Active') {
      return NextResponse.json(
        { error: `Visit is ${visit.status.toLowerCase()}. Only active visits can be billed.` },
        { status: 400 }
      )
    }

    const currentIdx = stageIndex(visit.stage)
    if (currentIdx < PRESCRIBED_INDEX) {
      return NextResponse.json(
        { error: 'Cannot create invoice at this stage', details: `Visit must be at "Prescribed" stage or later. Current stage: ${visit.stage}` },
        { status: 400 }
      )
    }

    if (currentIdx >= BILLED_INDEX) {
      return NextResponse.json(
        { error: 'Invoice already created', details: `Visit is already at "${visit.stage}" stage` },
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

    // Auto-generate invoice number
    const lastInvoice = await db.invoice.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { invoiceNumber: true },
    })
    const invoiceNumber = generateInvoiceNumber(lastInvoice?.invoiceNumber ?? null)

    // Transaction: create invoice + advance visit to "Billed"
    const today = new Date().toISOString().split('T')[0]
    const result = await db.$transaction(async (tx) => {
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

      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          patientId: visit.patientId,
          date: today,
          dueDate: null,
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
          status: calc.grandTotal <= 0 ? 'Paid' : 'Unpaid',
          items: { create: itemData },
        },
        include: {
          patient: { select: { id: true, patientId: true, name: true, phone: true } },
          items: true,
        },
      })

      // Advance visit stage
      const currentStageRecord = visit.stages.find(s => s.stage === visit.stage && s.status === 'Active')
      if (currentStageRecord) {
        await tx.visitStage.update({
          where: { id: currentStageRecord.id },
          data: {
            status: 'Completed',
            completedAt: new Date(),
            completedById: auth.user!.id,
            notes: `Invoice ${invoiceNumber} created — ₹${calc.grandTotal.toFixed(2)}`,
          },
        })
      }

      for (let i = currentIdx + 1; i < BILLED_INDEX; i++) {
        const skipStageRecord = visit.stages.find(s => s.stage === VISIT_STAGES[i] && s.status === 'Pending')
        if (skipStageRecord) {
          await tx.visitStage.update({
            where: { id: skipStageRecord.id },
            data: { status: 'Skipped' },
          })
        }
      }

      const billedStageRecord = visit.stages.find(s => s.stage === 'Billed' && s.status === 'Pending')
      if (billedStageRecord) {
        await tx.visitStage.update({
          where: { id: billedStageRecord.id },
          data: { status: 'Active' },
        })
      }

      const updatedVisit = await tx.patientVisit.update({
        where: { id },
        data: { stage: 'Billed' },
        include: {
          patient: { select: { id: true, patientId: true, name: true, phone: true } },
          stages: { orderBy: { createdAt: 'asc' } },
        },
      })

      return { invoice, updatedVisit }
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'billing',
      details: {
        invoiceNumber: result.invoice.invoiceNumber,
        patientId: visit.patient.patientId,
        patientName: visit.patient.name,
        visitId: visit.visitId,
        grandTotal: result.invoice.grandTotal,
        discountType: data.discountType,
        isInterstate: data.isInterstate,
        roundOff: calc.roundOff,
        itemCount: data.items.length,
      },
      ...extractRequestInfo(request),
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'STATUS_CHANGE',
      module: 'patient-visits',
      details: {
        visitId: visit.visitId,
        patientId: visit.patient.patientId,
        patientName: visit.patient.name,
        fromStage: visit.stage,
        toStage: 'Billed',
        reason: `Invoice ${result.invoice.invoiceNumber} created`,
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({
      data: result.invoice,
      visit: result.updatedVisit,
    }, { status: 201 })
  } catch (error) {
    console.error('[VISIT_CREATE_INVOICE]', error)
    return NextResponse.json(
      { error: 'Failed to create invoice', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}