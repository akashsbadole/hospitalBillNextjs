import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'

// ── GET: Auto-calculate billing items for a visit ────────────────────────
// Returns suggested invoice items based on visit context:
// - Consultation fee (from assigned doctor)
// - Lab test charges (from ordered tests, matched to LabTestCatalog)
// - Room charges for IPD (bed daily rate × days stayed)
// - Prescription medicine charges (from medicines inventory, if available)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/patient-visits')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params

    // Fetch visit with relations (separate queries to avoid circular type reference)
    const visit = await db.patientVisit.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            patientId: true,
            name: true,
            phone: true,
            insuranceProvider: true,
            insuranceNumber: true,
          },
        },
        stages: { orderBy: { createdAt: 'asc' } },
        labOrders: {
          include: { test: { select: { name: true, price: true, gstRate: true, hsnCode: true, category: true } } },
        },
      },
    })

    let beds: Array<{ bedId: string; bedNumber: string; dailyRate: number; ward: { name: string } | null }> = []
    if (visit?.patientId) {
      beds = await db.bed.findMany({
        where: { currentPatientId: visit.patientId },
        include: { ward: { select: { name: true } } },
      })
    }

    if (!visit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 })
    }

    // Fetch doctor info separately (no direct relation on PatientVisit)
    let doctorInfo: { name: string | null; specialization: string | null; consultationFee: number } | null = null
    if (visit.doctorId) {
      const doc = await db.doctor.findUnique({ where: { id: visit.doctorId }, select: { name: true, specialization: true, consultationFee: true } })
      if (doc) doctorInfo = doc
    }

    const items: Array<{
      description: string
      hsnCode: string
      quantity: number
      unitPrice: number
      gstRate: number
      type: 'Service' | 'Medicine' | 'Lab Test' | 'Room Charge' | 'Package'
      source: string
    }> = []

    // 1. Consultation Fee
    if (doctorInfo) {
      const fee = doctorInfo.consultationFee || 500
      const spec = doctorInfo.specialization || 'General'
      const docName = doctorInfo.name || 'Doctor'
      items.push({
        description: `${spec} Consultation — Dr. ${docName}`,
        hsnCode: '0011',
        quantity: 1,
        unitPrice: fee,
        gstRate: 5,
        type: 'Service',
        source: 'doctor',
      })
    }

    // 2. Lab Test Charges (from LabTestCatalog prices)
    if (visit.labOrders && visit.labOrders.length > 0) {
      const seenTests = new Set<string>()
      for (const order of visit.labOrders) {
        if (seenTests.has(order.test.name)) continue
        seenTests.add(order.test.name)
        items.push({
          description: order.test.name,
          hsnCode: order.test.hsnCode || '0013',
          quantity: 1,
          unitPrice: order.test.price,
          gstRate: order.test.gstRate,
          type: 'Lab Test',
          source: 'lab-tests',
        })
      }
    }

    // 3. Room Charges for IPD
    if (visit.visitType === 'IPD' && visit.admissionDate) {
      // Find the allocated bed for this visit
      const allocatedBed = await db.bed.findFirst({
        where: { currentVisitId: id },
        include: { ward: { select: { name: true } } },
      })

      if (allocatedBed) {
        const admission = new Date(visit.admissionDate)
        const today = new Date()
        const days = Math.max(1, Math.ceil((today.getTime() - admission.getTime()) / (1000 * 60 * 60 * 24)))
        const rate = allocatedBed.dailyRate || 1500

        items.push({
          description: `${allocatedBed.ward.name} — Bed ${allocatedBed.bedNumber} (${days} day${days > 1 ? 's' : ''})`,
          hsnCode: '0010',
          quantity: days,
          unitPrice: rate,
          gstRate: 5,
          type: 'Room Charge',
          source: 'bed',
        })
      }
    }

    // 4. Prescription medicines (check for prescribed stage notes)
    const prescribedStage = visit.stages.find(s => s.stage === 'Prescribed')
    if (prescribedStage?.notes) {
      try {
        const medicines = JSON.parse(prescribedStage.notes)
        if (Array.isArray(medicines)) {
          for (const med of medicines) {
            if (!med.medicine) continue
            // Try to find the medicine in inventory for pricing
            const medRecord = await db.medicine.findFirst({
              where: { name: { contains: med.medicine }, status: 'Active' },
              select: { sellingPrice: true, gstRate: true, hsnCode: true },
            })
            items.push({
              description: `${med.medicine}${med.dosage ? ` — ${med.dosage}` : ''}${med.frequency ? ` (${med.frequency})` : ''}${med.duration ? ` — ${med.duration}` : ''}`,
              hsnCode: medRecord?.hsnCode || '3004',
              quantity: 1,
              unitPrice: medRecord?.sellingPrice || 0,
              gstRate: medRecord?.gstRate || 12,
              type: 'Medicine',
              source: 'prescription',
            })
          }
        }
      } catch {
        // notes might not be valid JSON
      }
    }

    // Calculate totals
    let subtotal = 0
    let totalGst = 0
    for (const item of items) {
      const lineBase = item.unitPrice * item.quantity
      subtotal += lineBase
      totalGst += (lineBase * item.gstRate) / 100
    }
    const grandTotal = parseFloat((subtotal + totalGst).toFixed(2))

    return NextResponse.json({
      data: {
        visitId: visit.visitId,
        patientId: visit.patient.patientId,
        patientName: visit.patient.name,
        visitType: visit.visitType,
        department: visit.department,
        doctorName: doctorInfo?.name || null,
        doctorSpecialization: doctorInfo?.specialization || null,
        insuranceProvider: visit.patient.insuranceProvider || null,
        insuranceNumber: visit.patient.insuranceNumber || null,
        items,
        summary: {
          consultationFee: doctorInfo?.consultationFee || 500,
          labTestCount: items.filter(i => i.source === 'lab-tests').length,
          labTestTotal: items.filter(i => i.source === 'lab-tests').reduce((s, i) => s + i.unitPrice * i.quantity, 0),
          roomDays: items.find(i => i.source === 'bed')?.quantity || 0,
          roomDailyRate: items.find(i => i.source === 'bed')?.unitPrice || 0,
          medicineCount: items.filter(i => i.source === 'prescription').length,
          medicineTotal: items.filter(i => i.source === 'prescription').reduce((s, i) => s + i.unitPrice * i.quantity, 0),
        },
        totals: {
          subtotal: parseFloat(subtotal.toFixed(2)),
          totalGst: parseFloat(totalGst.toFixed(2)),
          grandTotal,
        },
      },
    })
  } catch (error) {
    console.error('[BILLING_SUMMARY_GET]', error)
    return NextResponse.json(
      { error: 'Failed to generate billing summary', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}