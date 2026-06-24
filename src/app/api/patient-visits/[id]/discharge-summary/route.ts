import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── GET ──────────────────────────────────────────────────────────────────
// Generates a comprehensive discharge summary for a completed/active visit
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/patient-visits')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params

    // Fetch visit with all related data
    const visit = await db.patientVisit.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true, patientId: true, name: true, phone: true, email: true,
            gender: true, dateOfBirth: true, bloodGroup: true,
            address: true, city: true, state: true, pincode: true,
          },
        },
        stages: { orderBy: { createdAt: 'asc' } },
        analyses: { orderBy: { createdAt: 'desc' } },
      },
    })

    if (!visit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 })
    }

    // Fetch prescriptions for this patient (linked via patientId, filtered by visit date range)
    const prescriptions = await db.prescription.findMany({
      where: {
        patientId: visit.patientId,
        date: visit.admissionDate || visit.createdAt.toISOString().split('T')[0],
      },
      include: {
        doctor: { select: { name: true, specialization: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Fetch invoices for this patient
    const invoices = await db.invoice.findMany({
      where: { patientId: visit.patientId },
      include: { payments: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    // Fetch doctor info
    let doctorName = visit.doctorId
      ? (await db.doctor.findUnique({ where: { id: visit.doctorId }, select: { name: true } }))?.name ?? null
      : null

    // Calculate age
    const age = visit.patient.dateOfBirth
      ? Math.floor((new Date().getTime() - new Date(visit.patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : null

    // Parse prescription notes to extract medications
    const medications: Array<{ name: string; dosage: string; frequency: string; duration: string }> = []
    for (const rx of prescriptions) {
      if (rx.notes) {
        try {
          const meds = JSON.parse(rx.notes)
          if (Array.isArray(meds)) {
            for (const m of meds) {
              medications.push({
                name: m.medicine || '',
                dosage: m.dosage || '',
                frequency: m.frequency || '',
                duration: m.duration || '',
              })
            }
          }
        } catch {
          // notes might be plain text, skip
        }
      }
    }

    // Extract treatments from prescription notes or chief complaint
    const treatments: string[] = []
    for (const rx of prescriptions) {
      if (rx.diagnosis) treatments.push(rx.diagnosis)
    }
    if (visit.chiefComplaint && !treatments.includes(visit.chiefComplaint)) {
      treatments.unshift(visit.chiefComplaint)
    }

    // Extract diagnosis from prescriptions or chief complaint
    const diagnosis = prescriptions[0]?.diagnosis || visit.chiefComplaint || 'Not specified'

    // Auto-generate follow-up instructions
    const followUpInstructions = generateFollowUpInstructions(diagnosis, medications)

    // Build workflow timeline
    const workflowTimeline = visit.stages.map(s => ({
      stage: s.stage,
      status: s.status,
      completedAt: s.completedAt?.toISOString() ?? null,
      notes: s.notes ?? undefined,
    }))

    // Build discharge notes
    const dischargeNotes = visit.notes || 'No additional discharge notes provided.'

    const summary = {
      patient: {
        name: visit.patient.name,
        patientId: visit.patient.patientId,
        age: age ?? null,
        gender: visit.patient.gender,
        bloodGroup: visit.patient.bloodGroup,
        phone: visit.patient.phone,
        address: [visit.patient.address, visit.patient.city, visit.patient.state, visit.patient.pincode]
          .filter(Boolean).join(', ') || null,
      },
      visit: {
        visitId: visit.visitId,
        admissionDate: visit.admissionDate || visit.createdAt.toISOString().split('T')[0],
        dischargeDate: visit.dischargeDate
          || (visit.status === 'Completed' ? visit.updatedAt.toISOString().split('T')[0] : null),
        department: visit.department || 'General Medicine',
        doctorName: doctorName || 'Not assigned',
        visitType: visit.visitType,
      },
      diagnosis,
      vitals: {
        temperature: visit.temperature,
        bloodPressure: visit.bloodPressure,
        pulse: visit.pulse,
        oxygenLevel: visit.oxygenLevel,
        weight: visit.weight,
        height: visit.height,
      },
      treatments,
      medications,
      labResults: ['Results pending — to be updated when lab reports are available'] as string[],
      invoices: invoices.map(inv => ({
        invoiceNumber: inv.invoiceNumber,
        grandTotal: inv.grandTotal,
        status: inv.status,
        paidAmount: inv.paidAmount,
      })),
      payments: invoices.flatMap(inv => inv.payments.map(p => ({
        paymentId: p.paymentId,
        amount: p.amount,
        method: p.method,
        status: p.status,
      }))),
      dischargeNotes,
      followUpInstructions,
      workflowTimeline,
    }

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'VIEW',
      module: 'patient-visits',
      details: {
        visitId: visit.visitId,
        patientId: visit.patient.patientId,
        patientName: visit.patient.name,
        type: 'discharge-summary',
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: summary })
  } catch (error) {
    console.error('[DISCHARGE_SUMMARY_GET]', error)
    return NextResponse.json(
      { error: 'Failed to generate discharge summary', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── Helper: Generate follow-up instructions based on diagnosis & medications ──
function generateFollowUpInstructions(
  diagnosis: string,
  medications: Array<{ name: string; dosage: string; frequency: string; duration: string }>
): string {
  const instructions: string[] = []

  if (medications.length > 0) {
    instructions.push('• Continue all prescribed medications as directed by your physician.')
    instructions.push('• Do not stop or change medication dosage without consulting your doctor.')
    const hasDurationMeds = medications.some(m => m.duration)
    if (hasDurationMeds) {
      instructions.push('• Complete the full course of antibiotics/medications even if you feel better.')
    }
  }

  if (diagnosis && diagnosis !== 'Not specified') {
    instructions.push(`• Follow-up appointment recommended within 7 days for: ${diagnosis}.`)
  } else {
    instructions.push('• Follow-up appointment recommended within 7 days.')
  }

  instructions.push('• Watch for any warning signs such as fever, severe pain, difficulty breathing, or unusual symptoms.')
  instructions.push('• Maintain adequate hydration and rest as advised.')
  instructions.push('• In case of emergency, visit the nearest hospital or call emergency services.')
  instructions.push('• Keep this summary for future reference and show it to your next healthcare provider.')

  return instructions.join('\n')
}
