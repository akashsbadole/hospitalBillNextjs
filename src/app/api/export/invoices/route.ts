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
  const auth = await authenticateRequest(request, '/api/billing')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const search = searchParams.get('search')?.trim() || ''
    const status = searchParams.get('status')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    const where: Record<string, unknown> = { ...getTenantFilter(auth.role, auth.branchId, request) }

    if (status) where.status = status

    if (fromDate || toDate) {
      const dateFilter: Record<string, unknown> = {}
      if (fromDate) dateFilter.gte = fromDate
      if (toDate) dateFilter.lte = toDate
      where.date = dateFilter
    }

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search } },
        { patient: { name: { contains: search } } },
        { patient: { patientId: { contains: search } } },
      ]
    }

    const invoices = await db.invoice.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        patient: { select: { name: true, phone: true } },
      },
    })

    const headers = [
      'Invoice No', 'Patient Name', 'Patient Phone', 'Date', 'Due Date',
      'Subtotal', 'CGST', 'SGST', 'IGST', 'Total GST', 'Grand Total',
      'Discount', 'Paid Amount', 'Balance', 'Status',
    ]

    const rows = invoices.map((inv) => [
      inv.invoiceNumber,
      inv.patient.name,
      inv.patient.phone,
      inv.date,
      inv.dueDate || '',
      inv.subtotal.toFixed(2),
      inv.cgst.toFixed(2),
      inv.sgst.toFixed(2),
      inv.igst.toFixed(2),
      inv.totalGst.toFixed(2),
      inv.grandTotal.toFixed(2),
      inv.discount.toFixed(2),
      inv.paidAmount.toFixed(2),
      (inv.grandTotal - inv.paidAmount).toFixed(2),
      inv.status,
    ])

    const today = new Date().toISOString().split('T')[0]
    return buildCsvResponse(headers, rows, `invoices-${today}.csv`)
  } catch (error) {
    console.error('[EXPORT_INVOICES]', error)
    return NextResponse.json(
      { error: 'Export failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}