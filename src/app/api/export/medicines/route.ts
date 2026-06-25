import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'
import { buildCsvResponse } from '@/lib/csv-utils'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/export/medicines')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const search = searchParams.get('search')?.trim() || ''
    const category = searchParams.get('category')

    const where: Record<string, unknown> = {}
    if (category && category !== 'all') where.category = category
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { medicineId: { contains: search } },
        { manufacturer: { contains: search } },
      ]
    }

    const medicines = await db.medicine.findMany({ where, orderBy: { name: 'asc' } })

    const headers = [
      'Medicine ID', 'Name', 'Category', 'Manufacturer', 'Batch Number',
      'Expiry Date', 'Purchase Price', 'Selling Price', 'Stock', 'Min Stock',
      'GST Rate', 'HSN Code', 'Barcode', 'Status',
    ]

    const rows = medicines.map(m => [
      m.medicineId, m.name, m.category || '', m.manufacturer || '',
      m.batchNumber || '', m.expiryDate || '', m.purchasePrice, m.sellingPrice,
      m.stock, m.minStock, m.gstRate, m.hsnCode || '', m.barcode || '', m.status,
    ])

    const today = new Date().toISOString().split('T')[0]
    return buildCsvResponse(headers, rows, `medicines-${today}.csv`)
  } catch (error) {
    console.error('[EXPORT_MEDICINES]', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
