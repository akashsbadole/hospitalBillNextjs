import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'

function toTsQuery(input: string): string {
  return input
    .replace(/[^\w\s-]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.replace(/-/g, ' ').trim())
    .filter(Boolean)
    .map(w => `${w}:*`)
    .join(' & ')
}

type SearchRow = Record<string, unknown>

async function tryFts<T extends SearchRow>(sql: string, tsq: string, limit: number): Promise<T[] | null> {
  if (tsq.length === 0) return null
  try {
    return await db.$queryRawUnsafe<T[]>(sql, tsq, limit)
  } catch {
    return null
  }
}

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

    const searchResults: Record<string, SearchRow[]> = {}
    const likeTerm = `%${q}%`
    const prefixTerm = `${q}%`
    const tsq = toTsQuery(q)
    const queries: Promise<void>[] = []

    if (type === 'all' || type === 'patients') {
      queries.push(
        (async () => {
          let rows = tsq ? await tryFts<SearchRow>(
            `SELECT id, "patientId", name, phone, email, "bloodGroup", gender, status
             FROM "Patient"
             WHERE fts_vector @@ to_tsquery('english', $1)
             ORDER BY ts_rank(fts_vector, to_tsquery('english', $1)) DESC, "createdAt" DESC
             LIMIT $2`,
            tsq, limit,
          ) : null
          if (!rows || rows.length === 0) {
            rows = await db.$queryRawUnsafe<SearchRow[]>(
              `SELECT id, "patientId", name, phone, email, "bloodGroup", gender, status
               FROM "Patient"
               WHERE name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1 OR "patientId" ILIKE $1
               ORDER BY CASE WHEN name ILIKE $2 THEN 0 WHEN "patientId" ILIKE $2 THEN 1 ELSE 2 END, "createdAt" DESC
               LIMIT $3`,
              likeTerm, prefixTerm, limit,
            )
          }
          searchResults['patients'] = rows
        })()
      )
    }

    if (type === 'all' || type === 'invoices') {
      queries.push(
        (async () => {
          let rows = tsq ? await tryFts<SearchRow>(
            `SELECT i.id, i."invoiceNumber", i.date, i.status, i."grandTotal", i."paidAmount", p.name as "patientName"
             FROM "Invoice" i
             LEFT JOIN "Patient" p ON p.id = i."patientId"
             WHERE i.fts_vector @@ to_tsquery('english', $1)
             ORDER BY ts_rank(i.fts_vector, to_tsquery('english', $1)) DESC, i."createdAt" DESC
             LIMIT $2`,
            tsq, limit,
          ) : null
          if (!rows || rows.length === 0) {
            rows = await db.$queryRawUnsafe<SearchRow[]>(
              `SELECT i.id, i."invoiceNumber", i.date, i.status, i."grandTotal", i."paidAmount", p.name as "patientName"
               FROM "Invoice" i
               LEFT JOIN "Patient" p ON p.id = i."patientId"
               WHERE i."invoiceNumber" ILIKE $1
               ORDER BY CASE WHEN i."invoiceNumber" ILIKE $2 THEN 0 ELSE 1 END, i."createdAt" DESC
               LIMIT $3`,
              likeTerm, prefixTerm, limit,
            )
          }
          searchResults['invoices'] = rows
        })()
      )
    }

    if (type === 'all' || type === 'prescriptions') {
      queries.push(
        (async () => {
          let rows = tsq ? await tryFts<SearchRow>(
            `SELECT p.id, p."prescriptionId", p.date, p.diagnosis, pt.name as "patientName", d.name as "doctorName"
             FROM "Prescription" p
             LEFT JOIN "Patient" pt ON pt.id = p."patientId"
             LEFT JOIN "Doctor" d ON d.id = p."doctorId"
             WHERE p.fts_vector @@ to_tsquery('english', $1)
             ORDER BY ts_rank(p.fts_vector, to_tsquery('english', $1)) DESC, p."createdAt" DESC
             LIMIT $2`,
            tsq, limit,
          ) : null
          if (!rows || rows.length === 0) {
            rows = await db.$queryRawUnsafe<SearchRow[]>(
              `SELECT p.id, p."prescriptionId", p.date, p.diagnosis, pt.name as "patientName", d.name as "doctorName"
               FROM "Prescription" p
               LEFT JOIN "Patient" pt ON pt.id = p."patientId"
               LEFT JOIN "Doctor" d ON d.id = p."doctorId"
               WHERE p."prescriptionId" ILIKE $1 OR p.diagnosis ILIKE $1
               ORDER BY p."createdAt" DESC LIMIT $2`,
              likeTerm, limit,
            )
          }
          searchResults['prescriptions'] = rows
        })()
      )
    }

    if (type === 'all' || type === 'appointments') {
      queries.push(
        (async () => {
          let rows = tsq ? await tryFts<SearchRow>(
            `SELECT a.id, a."aptId", a.date, a.time, a.status, a.type, pt.name as "patientName", d.name as "doctorName"
             FROM "Appointment" a
             LEFT JOIN "Patient" pt ON pt.id = a."patientId"
             LEFT JOIN "Doctor" d ON d.id = a."doctorId"
             WHERE a.fts_vector @@ to_tsquery('english', $1)
             ORDER BY ts_rank(a.fts_vector, to_tsquery('english', $1)) DESC, a."createdAt" DESC
             LIMIT $2`,
            tsq, limit,
          ) : null
          if (!rows || rows.length === 0) {
            rows = await db.$queryRawUnsafe<SearchRow[]>(
              `SELECT a.id, a."aptId", a.date, a.time, a.status, a.type, pt.name as "patientName", d.name as "doctorName"
               FROM "Appointment" a
               LEFT JOIN "Patient" pt ON pt.id = a."patientId"
               LEFT JOIN "Doctor" d ON d.id = a."doctorId"
               WHERE a."aptId" ILIKE $1 OR a.notes ILIKE $1
               ORDER BY a."createdAt" DESC LIMIT $2`,
              likeTerm, limit,
            )
          }
          searchResults['appointments'] = rows
        })()
      )
    }

    if (type === 'all' || type === 'doctors') {
      queries.push(
        (async () => {
          let rows = tsq ? await tryFts<SearchRow>(
            `SELECT id, "doctorId", name, specialization, qualification, "consultationFee", phone, status
             FROM "Doctor"
             WHERE fts_vector @@ to_tsquery('english', $1)
             ORDER BY ts_rank(fts_vector, to_tsquery('english', $1)) DESC, name ASC
             LIMIT $2`,
            tsq, limit,
          ) : null
          if (!rows || rows.length === 0) {
            rows = await db.$queryRawUnsafe<SearchRow[]>(
              `SELECT id, "doctorId", name, specialization, qualification, "consultationFee", phone, status
               FROM "Doctor"
               WHERE name ILIKE $1 OR specialization ILIKE $1 OR "doctorId" ILIKE $1 OR qualification ILIKE $1
               ORDER BY CASE WHEN name ILIKE $2 THEN 0 ELSE 1 END, name ASC
               LIMIT $3`,
              likeTerm, prefixTerm, limit,
            )
          }
          searchResults['doctors'] = rows
        })()
      )
    }

    if (type === 'all' || type === 'medicines') {
      queries.push(
        (async () => {
          let rows = tsq ? await tryFts<SearchRow>(
            `SELECT id, "medicineId", name, category, manufacturer, "batchNumber", stock, "minStock", "sellingPrice"
             FROM "Medicine"
             WHERE fts_vector @@ to_tsquery('english', $1)
             ORDER BY ts_rank(fts_vector, to_tsquery('english', $1)) DESC, name ASC
             LIMIT $2`,
            tsq, limit,
          ) : null
          if (!rows || rows.length === 0) {
            rows = await db.$queryRawUnsafe<SearchRow[]>(
              `SELECT id, "medicineId", name, category, manufacturer, "batchNumber", stock, "minStock", "sellingPrice"
               FROM "Medicine"
               WHERE name ILIKE $1 OR "medicineId" ILIKE $1 OR category ILIKE $1 OR manufacturer ILIKE $1
               ORDER BY CASE WHEN name ILIKE $2 THEN 0 ELSE 1 END, name ASC
               LIMIT $3`,
              likeTerm, prefixTerm, limit,
            )
          }
          searchResults['medicines'] = rows
        })()
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
