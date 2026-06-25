import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'
import { parseCsv, buildImportResponse, type CsvImportResult } from '@/lib/csv-utils'

const FIELD_MAP: Record<string, string> = {
  'patient': 'patientRef',
  'patient name': 'patientRef',
  'patient phone': 'patientPhone',
  'doctor': 'doctorRef',
  'doctor name': 'doctorRef',
  'date': 'date',
  'time': 'time',
  'duration': 'duration',
  'type': 'type',
  'status': 'status',
  'notes': 'notes',
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/import/appointments')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const body = await request.json()
    const { headers, rows } = parseCsv(body.csv || '')

    if (headers.length === 0) {
      return NextResponse.json({ error: 'CSV must have headers and at least one data row' }, { status: 400 })
    }

    const result: CsvImportResult = { success: 0, errors: [] }

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i]
        const data: Record<string, unknown> = {}

        for (let h = 0; h < headers.length; h++) {
          const mappedField = FIELD_MAP[headers[h].toLowerCase().trim()]
          if (mappedField) {
            const val = row[h]?.trim() || ''
            if (val) data[mappedField] = val
          }
        }

        if (!data.date || !data.time) {
          result.errors.push({ row: i + 2, message: 'date and time are required' })
          continue
        }

        let patientId = data.patientRef as string
        let doctorId = data.doctorRef as string

        if (data.patientPhone && !patientId) {
          const patient = await db.patient.findFirst({ where: { phone: data.patientPhone as string } })
          if (patient) patientId = patient.id
        }

        if (!patientId && data.patientRef) {
          const patient = await db.patient.findFirst({
            where: {
              OR: [
                { patientId: data.patientRef as string },
                { name: { contains: data.patientRef as string } },
                { phone: data.patientRef as string },
              ],
            },
          })
          if (patient) patientId = patient.id
        }

        if (!doctorId && data.doctorRef) {
          const doctor = await db.doctor.findFirst({
            where: {
              OR: [
                { doctorId: data.doctorRef as string },
                { name: { contains: data.doctorRef as string } },
              ],
            },
          })
          if (doctor) doctorId = doctor.id
        }

        if (!patientId) {
          result.errors.push({ row: i + 2, message: `Patient not found: ${data.patientRef || data.patientPhone}` })
          continue
        }
        if (!doctorId) {
          result.errors.push({ row: i + 2, message: `Doctor not found: ${data.doctorRef}` })
          continue
        }

        await db.appointment.create({
          data: {
            patientId,
            doctorId,
            aptId: `APT-${Date.now()}-${i}`,
            date: data.date as string,
            time: data.time as string,
            duration: data.duration ? Number(data.duration) : 30,
            type: (data.type as string) || 'Consultation',
            status: (data.status as string) || 'Scheduled',
            notes: data.notes as string,
          },
        })
        result.success++
      } catch (err) {
        result.errors.push({ row: i + 2, message: err instanceof Error ? err.message : 'Unknown error' })
      }
    }

    return buildImportResponse(result)
  } catch (error) {
    console.error('[IMPORT_APPOINTMENTS]', error)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
