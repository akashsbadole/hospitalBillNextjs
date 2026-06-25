import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'
import { parseCsv, extractColumn, buildImportResponse, type CsvImportResult } from '@/lib/csv-utils'

const FIELD_MAP: Record<string, string> = {
  'patient id': 'patientId',
  'name': 'name',
  'phone': 'phone',
  'email': 'email',
  'date of birth': 'dateOfBirth',
  'dob': 'dateOfBirth',
  'gender': 'gender',
  'blood group': 'bloodGroup',
  'address': 'address',
  'city': 'city',
  'state': 'state',
  'pincode': 'pincode',
  'aadhaar': 'aadhaarNumber',
  'aadhaar number': 'aadhaarNumber',
  'emergency contact': 'emergencyContact',
  'emergency phone': 'emergencyPhone',
  'insurance provider': 'insuranceProvider',
  'insurance number': 'insuranceNumber',
  'marital status': 'maritalStatus',
  'occupation': 'occupation',
  'allergies': 'allergies',
  'past treatments': 'pastTreatments',
  'status': 'status',
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/import/patients')
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

        if (!data.name || !data.phone) {
          result.errors.push({ row: i + 2, message: 'name and phone are required' })
          continue
        }

        if (data.allergies && typeof data.allergies === 'string') {
          data.allergies = String(data.allergies).split(',').map(s => s.trim()).filter(Boolean)
        }
        if (data.pastTreatments && typeof data.pastTreatments === 'string') {
          data.pastTreatments = String(data.pastTreatments).split(',').map(s => s.trim()).filter(Boolean)
        }

        await db.patient.create({ data: data as any })
        result.success++
      } catch (err) {
        result.errors.push({ row: i + 2, message: err instanceof Error ? err.message : 'Unknown error' })
      }
    }

    return buildImportResponse(result)
  } catch (error) {
    console.error('[IMPORT_PATIENTS]', error)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
