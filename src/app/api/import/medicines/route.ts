import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'
import { parseCsv, buildImportResponse, type CsvImportResult } from '@/lib/csv-utils'

const FIELD_MAP: Record<string, string> = {
  'medicine id': 'medicineId',
  'name': 'name',
  'category': 'category',
  'manufacturer': 'manufacturer',
  'batch number': 'batchNumber',
  'batch no': 'batchNumber',
  'expiry date': 'expiryDate',
  'expiry': 'expiryDate',
  'purchase price': 'purchasePrice',
  'selling price': 'sellingPrice',
  'price': 'sellingPrice',
  'stock': 'stock',
  'quantity': 'stock',
  'min stock': 'minStock',
  'minimum stock': 'minStock',
  'gst rate': 'gstRate',
  'gst': 'gstRate',
  'hsn code': 'hsnCode',
  'barcode': 'barcode',
  'status': 'status',
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/import/medicines')
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

        if (!data.name) {
          result.errors.push({ row: i + 2, message: 'name is required' })
          continue
        }

        if (data.purchasePrice) data.purchasePrice = Number(data.purchasePrice)
        if (data.sellingPrice) data.sellingPrice = Number(data.sellingPrice)
        if (data.stock) data.stock = Number(data.stock)
        if (data.minStock) data.minStock = Number(data.minStock)
        if (data.gstRate) data.gstRate = Number(data.gstRate)

        await db.medicine.create({ data: data as any })
        result.success++
      } catch (err) {
        result.errors.push({ row: i + 2, message: err instanceof Error ? err.message : 'Unknown error' })
      }
    }

    return buildImportResponse(result)
  } catch (error) {
    console.error('[IMPORT_MEDICINES]', error)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
