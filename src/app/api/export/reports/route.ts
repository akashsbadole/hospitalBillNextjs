import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest, getTenantFilter } from '@/lib/api-auth'

// ── CSV Helper ────────────────────────────────────────────────────────────
function escapeCsvField(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function buildCsvRow(fields: unknown[]): string {
  return fields.map(escapeCsvField).join(',')
}

function buildCsvResponse(headers: string[], rows: unknown[][], filename: string): NextResponse {
  const headerLine = headers.join(',')
  const dataLines = rows.map((r) => buildCsvRow(r)).join('\n')
  const csv = headerLine + '\n' + dataLines

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/reports')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const type = searchParams.get('type')?.trim()

    const today = new Date().toISOString().split('T')[0]
    const tenantFilter = getTenantFilter(auth.role, auth.branchId, request)

    switch (type) {
      case 'revenue':
        return await exportRevenueReport(today, tenantFilter)
      case 'billing':
        return await exportBillingReport(today, tenantFilter)
      case 'gst':
        return await exportGstReport(today, tenantFilter)
      case 'patient-flow':
        return await exportPatientFlowReport(today, tenantFilter)
      default:
        return NextResponse.json(
          { error: 'Invalid report type', details: 'Must be one of: revenue, billing, gst, patient-flow' },
          { status: 400 },
        )
    }
  } catch (error) {
    console.error('[EXPORT_REPORTS]', error)
    return NextResponse.json(
      { error: 'Export failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

// ── Revenue Report: Daily revenue breakdown ──────────────────────────────
async function exportRevenueReport(today: string, tenantFilter: Record<string, unknown>) {
  // Last 30 days
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const startDate = thirtyDaysAgo.toISOString().split('T')[0]

  const invoices = await db.invoice.findMany({
    where: {
      ...tenantFilter,
      date: { gte: startDate },
      status: { not: 'Cancelled' },
    },
    orderBy: { date: 'asc' },
    include: {
      payments: { where: { status: 'Success' } },
    },
  })

  // Group by date
  const dateMap = new Map<string, { revenue: number; payments: number; outstanding: number }>()

  for (const inv of invoices) {
    const existing = dateMap.get(inv.date) || { revenue: 0, payments: 0, outstanding: 0 }
    existing.revenue += inv.grandTotal
    const dayPayments = inv.payments.reduce((sum, p) => sum + p.amount, 0)
    existing.payments += dayPayments
    existing.outstanding += Math.max(0, inv.grandTotal - inv.paidAmount)
    dateMap.set(inv.date, existing)
  }

  // Fill all 30 days
  const rows: unknown[][] = []
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo)
    d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().split('T')[0]
    const data = dateMap.get(dateStr) || { revenue: 0, payments: 0, outstanding: 0 }
    rows.push([
      dateStr,
      data.revenue.toFixed(2),
      data.payments.toFixed(2),
      data.outstanding.toFixed(2),
    ])
  }

  const headers = ['Date', 'Revenue', 'Payments', 'Outstanding']
  return buildCsvResponse(headers, rows, `revenue-report-${today}.csv`)
}

// ── Billing Report: Invoice aging ────────────────────────────────────────
async function exportBillingReport(today: string, tenantFilter: Record<string, unknown>) {
  const invoices = await db.invoice.findMany({
    where: {
      ...tenantFilter,
      status: { in: ['Unpaid', 'Partially Paid', 'Overdue'] },
    },
    orderBy: { date: 'asc' },
    include: {
      patient: { select: { name: true } },
    },
  })

  const now = new Date()

  const headers = ['Invoice No', 'Patient', 'Amount', 'Days Overdue', 'Status']
  const rows = invoices.map((inv) => {
    let daysOverdue = 0
    if (inv.dueDate) {
      const due = new Date(inv.dueDate + 'T23:59:59')
      daysOverdue = Math.max(0, Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)))
    }

    return [
      inv.invoiceNumber,
      inv.patient.name,
      inv.grandTotal.toFixed(2),
      String(daysOverdue),
      inv.status,
    ]
  })

  return buildCsvResponse(headers, rows, `billing-report-${today}.csv`)
}

// ── GST Report: GST summary by rate ──────────────────────────────────────
async function exportGstReport(today: string, tenantFilter: Record<string, unknown>) {
  const invoices = await db.invoice.findMany({
    where: {
      ...tenantFilter,
      status: { not: 'Cancelled' },
    },
    include: { items: true },
  })

  // Group by GST rate
  const rateMap = new Map<number, { taxableAmount: number; cgst: number; sgst: number; igst: number; total: number }>()

  for (const inv of invoices) {
    for (const item of inv.items) {
      const rate = item.gstRate
      const existing = rateMap.get(rate) || { taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, total: 0 }

      const taxableAmount = item.quantity * item.unitPrice
      const gstTotal = item.gstAmount

      existing.taxableAmount += taxableAmount
      existing.total += gstTotal
      // Assume CGST/SGST split (50/50) unless IGST applies
      existing.cgst += gstTotal / 2
      existing.sgst += gstTotal / 2

      rateMap.set(rate, existing)
    }
  }

  const rates = Array.from(rateMap.entries()).sort((a, b) => a[0] - b[0])
  const headers = ['Rate (%)', 'Taxable Amount', 'CGST', 'SGST', 'IGST', 'Total GST']
  const rows = rates.map(([rate, data]) => [
    `${rate}%`,
    data.taxableAmount.toFixed(2),
    data.cgst.toFixed(2),
    data.sgst.toFixed(2),
    '0.00', // IGST is 0 for intra-state
    data.total.toFixed(2),
  ])

  return buildCsvResponse(headers, rows, `gst-report-${today}.csv`)
}

// ── Patient Flow Report: Stage distribution ──────────────────────────────
async function exportPatientFlowReport(today: string, tenantFilter: Record<string, unknown>) {
  const visits = await db.patientVisit.findMany({
    where: { ...tenantFilter, status: 'Active' },
    select: { stage: true },
  })

  const stageCount = new Map<string, number>()
  let total = 0

  for (const v of visits) {
    stageCount.set(v.stage, (stageCount.get(v.stage) || 0) + 1)
    total++
  }

  const stages = [
    'Registration', 'Triage', 'Waiting', 'In-Consultation',
    'Lab-Ordered', 'Lab-Done', 'Prescribed', 'Billed', 'Paid', 'Discharged',
  ]

  const headers = ['Stage', 'Count', 'Percentage']
  const rows = stages.map((stage) => {
    const count = stageCount.get(stage) || 0
    const pct = total > 0 ? ((count / total) * 100).toFixed(1) + '%' : '0%'
    return [stage, String(count), pct]
  })

  return buildCsvResponse(headers, rows, `patient-flow-report-${today}.csv`)
}