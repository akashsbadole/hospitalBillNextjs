import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'
import { buildCsvResponse } from '@/lib/csv-utils'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/export/appointments')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const search = searchParams.get('search')?.trim() || ''
    const status = searchParams.get('status')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const where: Record<string, unknown> = {}
    if (status && status !== 'all') where.status = status
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {}
      if (dateFrom) dateFilter.gte = dateFrom
      if (dateTo) dateFilter.lte = dateTo
      where.date = dateFilter
    }
    if (search) {
      where.OR = [
        { aptId: { contains: search } },
        { notes: { contains: search } },
      ]
    }

    const appointments = await db.appointment.findMany({
      where,
      include: { patient: { select: { name: true, phone: true } }, doctor: { select: { name: true } } },
      orderBy: [{ date: 'desc' }, { time: 'desc' }],
    })

    const headers = [
      'Appointment ID', 'Patient Name', 'Patient Phone', 'Doctor Name',
      'Date', 'Time', 'Duration', 'Type', 'Status', 'Notes',
    ]

    const rows = appointments.map(a => [
      a.aptId, a.patient.name, a.patient.phone, a.doctor.name,
      a.date, a.time, a.duration, a.type, a.status, a.notes || '',
    ])

    const today = new Date().toISOString().split('T')[0]
    return buildCsvResponse(headers, rows, `appointments-${today}.csv`)
  } catch (error) {
    console.error('[EXPORT_APPOINTMENTS]', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
