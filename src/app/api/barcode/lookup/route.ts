import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/barcode/lookup')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const code = searchParams.get('code')?.trim()

    if (!code) {
      return NextResponse.json({ error: 'Barcode code is required' }, { status: 400 })
    }

    const [medicine, patient, invoice] = await Promise.all([
      db.medicine.findFirst({
        where: { barcode: code, status: 'Active' },
        select: {
          id: true,
          medicineId: true,
          name: true,
          category: true,
          manufacturer: true,
          batchNumber: true,
          stock: true,
          minStock: true,
          sellingPrice: true,
          expiryDate: true,
          status: true,
        },
      }),
      db.patient.findFirst({
        where: { patientId: code },
        select: {
          id: true,
          patientId: true,
          name: true,
          phone: true,
          gender: true,
          bloodGroup: true,
          status: true,
        },
      }),
      db.invoice.findFirst({
        where: { invoiceNumber: code },
        select: {
          id: true,
          invoiceNumber: true,
          date: true,
          grandTotal: true,
          paidAmount: true,
          status: true,
          patient: { select: { name: true } },
        },
      }),
    ])

    if (medicine) {
      const stockStatus =
        medicine.stock <= 0 ? 'Out of Stock'
        : medicine.stock <= medicine.minStock ? 'Low Stock'
        : 'In Stock'

      return NextResponse.json({
        found: true,
        entityType: 'Medicine',
        entityId: medicine.id,
        displayId: medicine.medicineId,
        displayName: medicine.name,
        details: {
          category: medicine.category,
          manufacturer: medicine.manufacturer,
          batchNumber: medicine.batchNumber,
          stock: medicine.stock,
          stockStatus,
          sellingPrice: medicine.sellingPrice,
          expiryDate: medicine.expiryDate,
          status: medicine.status,
        },
      })
    }

    if (patient) {
      return NextResponse.json({
        found: true,
        entityType: 'Patient',
        entityId: patient.id,
        displayId: patient.patientId,
        displayName: patient.name,
        details: {
          phone: patient.phone,
          gender: patient.gender,
          bloodGroup: patient.bloodGroup,
          status: patient.status,
        },
      })
    }

    if (invoice) {
      const balance = invoice.grandTotal - invoice.paidAmount
      return NextResponse.json({
        found: true,
        entityType: 'Invoice',
        entityId: invoice.id,
        displayId: invoice.invoiceNumber,
        displayName: `Invoice ${invoice.invoiceNumber}`,
        details: {
          date: invoice.date,
          grandTotal: invoice.grandTotal,
          paidAmount: invoice.paidAmount,
          balance: Math.max(0, balance),
          status: invoice.status,
          patientName: invoice.patient.name,
        },
      })
    }

    return NextResponse.json({ found: false, entityType: null, entityId: null, displayName: null, details: null })
  } catch (error) {
    console.error('[BARCODE_LOOKUP_GET]', error)
    return NextResponse.json(
      { error: 'Barcode lookup failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
