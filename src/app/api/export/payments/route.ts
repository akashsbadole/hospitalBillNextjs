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
  const auth = await authenticateRequest(request, '/api/payments')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const search = searchParams.get('search')?.trim() || ''
    const status = searchParams.get('status')
    const method = searchParams.get('method')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    const where: Record<string, unknown> = { ...getTenantFilter(auth.role, auth.branchId, request) }

    if (status) where.status = status
    if (method) where.method = method

    if (fromDate || toDate) {
      const dateFilter: Record<string, unknown> = {}
      if (fromDate) dateFilter.gte = new Date(fromDate)
      if (toDate) dateFilter.lte = new Date(toDate + 'T23:59:59')
      where.createdAt = dateFilter
    }

    if (search) {
      where.OR = [
        { paymentId: { contains: search } },
        { patient: { name: { contains: search } } },
        { patient: { phone: { contains: search } } },
        { invoice: { invoiceNumber: { contains: search } } },
      ]
    }

    const payments = await db.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        invoice: { select: { invoiceNumber: true } },
        patient: { select: { name: true } },
      },
    })

    const headers = [
      'Payment ID', 'Invoice No', 'Patient Name', 'Amount',
      'Method', 'Status', 'Receipt No', 'Created Date',
    ]

    const rows = payments.map((pay) => [
      pay.paymentId,
      pay.invoice.invoiceNumber,
      pay.patient.name,
      pay.amount.toFixed(2),
      pay.method,
      pay.status,
      pay.receiptNumber || '',
      pay.createdAt.toISOString().split('T')[0],
    ])

    const today = new Date().toISOString().split('T')[0]
    return buildCsvResponse(headers, rows, `payments-${today}.csv`)
  } catch (error) {
    console.error('[EXPORT_PAYMENTS]', error)
    return NextResponse.json(
      { error: 'Export failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}