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
  const auth = await authenticateRequest(request, '/api/patients')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const search = searchParams.get('search')?.trim() || ''
    const status = searchParams.get('status')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    const where: Record<string, unknown> = { ...getTenantFilter(auth.role, auth.branchId, request) }

    if (status) where.status = status

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
        { patientId: { contains: search } },
      ]
    }

    if (fromDate || toDate) {
      const dateFilter: Record<string, unknown> = {}
      if (fromDate) dateFilter.gte = new Date(fromDate)
      if (toDate) dateFilter.lte = new Date(toDate + 'T23:59:59.999Z')
      where.createdAt = dateFilter
    }

    const patients = await db.patient.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    const headers = [
      'Patient ID', 'Name', 'Phone', 'Email', 'DOB', 'Gender',
      'Blood Group', 'City', 'State', 'Pincode',
      'Insurance Provider', 'Insurance Number', 'Status', 'Created Date',
    ]

    const rows = patients.map((p) => [
      p.patientId,
      p.name,
      p.phone,
      p.email || '',
      p.dateOfBirth || '',
      p.gender || '',
      p.bloodGroup || '',
      p.city || '',
      p.state || '',
      p.pincode || '',
      p.insuranceProvider || '',
      p.insuranceNumber || '',
      p.status,
      p.createdAt.toISOString().split('T')[0],
    ])

    const today = new Date().toISOString().split('T')[0]
    return buildCsvResponse(headers, rows, `patients-${today}.csv`)
  } catch (error) {
    console.error('[EXPORT_PATIENTS]', error)
    return NextResponse.json(
      { error: 'Export failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}