import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/search')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const q = searchParams.get('q')?.trim() || ''
    const limit = Math.min(20, Math.max(1, parseInt(searchParams.get('limit') || '5', 10)))
    const type = searchParams.get('type') || 'all'

    if (!q || q.length < 1) {
      return NextResponse.json({
        patients: [], invoices: [], prescriptions: [], appointments: [], doctors: [], medicines: [],
      })
    }

    const searchTerm = `%${q}%`
    const prefixTerm = `${q}%`
    const searchResults: Record<string, unknown[]> = {}

    const queries: Promise<void>[] = []

    if (type === 'all' || type === 'patients') {
      queries.push(
        db.$queryRawUnsafe<any[]>(
          `SELECT id, patientId, name, phone, email, bloodGroup, gender, status
           FROM Patient
           WHERE name ILIKE ? OR phone ILIKE ? OR email ILIKE ? OR patientId ILIKE ?
           ORDER BY
             CASE WHEN name ILIKE ? THEN 0 WHEN patientId ILIKE ? THEN 1 ELSE 2 END,
             createdAt DESC
           LIMIT ?`,
          searchTerm, searchTerm, searchTerm, searchTerm, prefixTerm, prefixTerm, limit
        ).then(rows => { searchResults['patients'] = rows })
      )
    }

    if (type === 'all' || type === 'invoices') {
      queries.push(
        db.$queryRawUnsafe<any[]>(
          `SELECT i.id, i.invoiceNumber, i.date, i.status, i.grandTotal, i.paidAmount, p.name as patientName
           FROM Invoice i
           LEFT JOIN Patient p ON p.id = i.patientId
           WHERE i.invoiceNumber ILIKE ?
           ORDER BY CASE WHEN i.invoiceNumber ILIKE ? THEN 0 ELSE 1 END, i.createdAt DESC
           LIMIT ?`,
          searchTerm, prefixTerm, limit
        ).then(rows => { searchResults['invoices'] = rows })
      )
    }

    if (type === 'all' || type === 'prescriptions') {
      queries.push(
        db.$queryRawUnsafe<any[]>(
          `SELECT p.id, p.prescriptionId, p.date, p.diagnosis, pt.name as patientName, d.name as doctorName
           FROM Prescription p
           LEFT JOIN Patient pt ON pt.id = p.patientId
           LEFT JOIN Doctor d ON d.id = p.doctorId
           WHERE p.prescriptionId ILIKE ? OR p.diagnosis ILIKE ?
           ORDER BY p.createdAt DESC LIMIT ?`,
          searchTerm, searchTerm, limit
        ).then(rows => { searchResults['prescriptions'] = rows })
      )
    }

    if (type === 'all' || type === 'appointments') {
      queries.push(
        db.$queryRawUnsafe<any[]>(
          `SELECT a.id, a.aptId, a.date, a.time, a.status, a.type, pt.name as patientName, d.name as doctorName
           FROM Appointment a
           LEFT JOIN Patient pt ON pt.id = a.patientId
           LEFT JOIN Doctor d ON d.id = a.doctorId
           WHERE a.aptId ILIKE ? OR a.notes ILIKE ?
           ORDER BY a.createdAt DESC LIMIT ?`,
          searchTerm, searchTerm, limit
        ).then(rows => { searchResults['appointments'] = rows })
      )
    }

    if (type === 'all' || type === 'doctors') {
      queries.push(
        db.$queryRawUnsafe<any[]>(
          `SELECT id, doctorId, name, specialization, qualification, consultationFee, phone, status
           FROM Doctor
           WHERE name ILIKE ? OR specialization ILIKE ? OR doctorId ILIKE ? OR qualification ILIKE ?
           ORDER BY CASE WHEN name ILIKE ? THEN 0 ELSE 1 END
           LIMIT ?`,
          searchTerm, searchTerm, searchTerm, searchTerm, prefixTerm, limit
        ).then(rows => { searchResults['doctors'] = rows })
      )
    }

    if (type === 'all' || type === 'medicines') {
      queries.push(
        db.$queryRawUnsafe<any[]>(
          `SELECT id, medicineId, name, category, manufacturer, batchNumber, stock, minStock, sellingPrice
           FROM Medicine
           WHERE name ILIKE ? OR medicineId ILIKE ? OR category ILIKE ? OR manufacturer ILIKE ?
           ORDER BY CASE WHEN name ILIKE ? THEN 0 ELSE 1 END
           LIMIT ?`,
          searchTerm, searchTerm, searchTerm, searchTerm, prefixTerm, limit
        ).then(rows => { searchResults['medicines'] = rows })
      )
    }

    await Promise.all(queries)

    return NextResponse.json({
      patients: searchResults['patients'] || [],
      invoices: searchResults['invoices'] || [],
      prescriptions: searchResults['prescriptions'] || [],
      appointments: searchResults['appointments'] || [],
      doctors: searchResults['doctors'] || [],
      medicines: searchResults['medicines'] || [],
    })
  } catch (error) {
    console.error('[SEARCH_GET]', error)
    return NextResponse.json(
      { error: 'Search failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
