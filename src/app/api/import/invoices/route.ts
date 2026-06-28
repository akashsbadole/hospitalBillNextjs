import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'
import { parseCsv, buildImportResponse, type CsvImportResult } from '@/lib/csv-utils'

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/import/invoices')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const body = await request.json()
    const { headers, rows } = parseCsv(body.csv || '')

    if (headers.length === 0) {
      return NextResponse.json({ error: 'CSV must have headers and at least one data row' }, { status: 400 })
    }

    const result: CsvImportResult = { success: 0, errors: [] }

    // Invoice import requires multi-step: group rows by invoice number
    const invoiceGroups: Record<string, { rowIndex: number; data: Record<string, string>; items: Record<string, string>[] }> = {}
    const invoiceNumIdx = headers.findIndex(h => /invoice\s*(no|number|#)?/i.test(h.trim()))

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i]
        const entry: Record<string, string> = {}
        for (let h = 0; h < headers.length; h++) {
          entry[headers[h].trim()] = row[h]?.trim() || ''
        }

        const invNum = entry[headers[invoiceNumIdx >= 0 ? invoiceNumIdx : 0]] || `IMPORT-${Date.now()}-${i}`

        if (!invoiceGroups[invNum]) {
          invoiceGroups[invNum] = { rowIndex: i, data: entry, items: [] }
        }

        if (entry['description'] || entry['item']) {
          invoiceGroups[invNum].items.push(entry)
        }
      } catch (err) {
        result.errors.push({ row: i + 2, message: err instanceof Error ? err.message : 'Unknown error' })
      }
    }

    for (const [invNum, group] of Object.entries(invoiceGroups)) {
      try {
        const { data, items } = group

        let patientId = data['patient id'] || data['patient'] || ''
        if (patientId) {
          const patient = await db.patient.findFirst({
            where: {
              OR: [
                { patientId },
                { name: { contains: patientId } },
                { phone: patientId },
              ],
            },
          })
          if (patient) patientId = patient.id
        }

        if (!patientId) {
          result.errors.push({ row: group.rowIndex + 2, message: `Patient not found for invoice ${invNum}` })
          continue
        }

        if (items.length === 0) {
          result.errors.push({ row: group.rowIndex + 2, message: `Invoice ${invNum} has no line items` })
          continue
        }

        const invoiceItems = items.map(item => ({
          description: item['description'] || item['item'] || 'Imported item',
          hsnCode: item['hsn code'] || item['hsn'] || null,
          quantity: parseInt(item['quantity'] || '1') || 1,
          unitPrice: parseFloat(item['unit price'] || item['price'] || '0') || 0,
          gstRate: parseFloat(item['gst rate'] || item['gst'] || '0') || 0,
          type: (item['type'] || 'Service') as string,
          total: (parseInt(item['quantity'] || '1') || 1) * (parseFloat(item['unit price'] || item['price'] || '0') || 0),
          gstAmount: 0,
        }))

        const subtotal = invoiceItems.reduce((s, it) => s + it.total, 0)
        const totalGst = invoiceItems.reduce((s, it) => s + (it.total * it.gstRate / 100), 0)
        const grandTotal = subtotal + totalGst

        await db.invoice.create({
          data: {
            patientId,
            invoiceNumber: `INV-${Date.now()}-${group.rowIndex}`,
            date: data['date'] || new Date().toISOString().split('T')[0],
            status: data['status'] || 'Unpaid',
            subtotal,
            grandTotal,
            totalGst,
            items: { createMany: { data: invoiceItems } },
          },
        })
        result.success++
      } catch (err) {
        result.errors.push({ row: group.rowIndex + 2, message: err instanceof Error ? err.message : 'Unknown error' })
      }
    }

    return buildImportResponse(result)
  } catch (error) {
    console.error('[IMPORT_INVOICES]', error)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
