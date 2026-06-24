import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── Helper: Indian Rupee amount formatter ──────────────────────────────
function inr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

// ── Helper: Format date ────────────────────────────────────────────────
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A'
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

// ── GET ──────────────────────────────────────────────────────────────────
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

    // Fetch doctor info
    let doctorName = 'Not Assigned'
    let doctorSpecialization = ''
    let doctorQualification = ''
    if (visit.doctorId) {
      const doctor = await db.doctor.findUnique({
        where: { id: visit.doctorId },
        select: { name: true, specialization: true, qualification: true },
      })
      if (doctor) {
        doctorName = doctor.name
        doctorSpecialization = doctor.specialization
        doctorQualification = doctor.qualification || ''
      }
    }

    // Fetch prescriptions
    const visitDate = visit.admissionDate || visit.createdAt.toISOString().split('T')[0]
    const prescriptions = await db.prescription.findMany({
      where: {
        patientId: visit.patientId,
        date: visitDate,
      },
      include: {
        doctor: { select: { name: true, specialization: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Parse medications from prescriptions
    const medications: Array<{ name: string; dosage: string; frequency: string; duration: string }> = []
    let diagnosisText = visit.chiefComplaint || 'Not specified'
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
          // notes might be plain text
        }
      }
      if (rx.diagnosis && rx.diagnosis !== 'Not specified') {
        diagnosisText = rx.diagnosis
      }
    }

    // Fetch invoices for billing summary
    const invoices = await db.invoice.findMany({
      where: { patientId: visit.patientId },
      include: { payments: { where: { status: 'Success' } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    // Calculate age
    const age = visit.patient.dateOfBirth
      ? Math.floor((new Date().getTime() - new Date(visit.patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : null

    // Clinic settings
    const clinic = await db.clinicSettings.findFirst()
    const clinicName = clinic?.clinicName || 'Hospital / Clinic'
    const clinicAddress = [clinic?.address, clinic?.city, clinic?.state, clinic?.pincode].filter(Boolean).join(', ')
    const clinicPhone = clinic?.phone || ''
    const clinicEmail = clinic?.email || ''
    const clinicGstin = clinic?.gstin || ''

    // Follow-up instructions
    const followUp = generateFollowUpInstructions(diagnosisText, medications)

    // Build HTML
    const html = buildDischargeHtml({
      clinicName,
      clinicAddress,
      clinicPhone,
      clinicEmail,
      clinicGstin,
      patient: {
        name: visit.patient.name,
        patientId: visit.patient.patientId,
        age,
        gender: visit.patient.gender,
        bloodGroup: visit.patient.bloodGroup,
        phone: visit.patient.phone,
        address: [visit.patient.address, visit.patient.city, visit.patient.state, visit.patient.pincode].filter(Boolean).join(', '),
      },
      visit: {
        visitId: visit.visitId,
        admissionDate: visit.admissionDate || visit.createdAt.toISOString().split('T')[0],
        dischargeDate: visit.dischargeDate || (visit.status === 'Completed' ? visit.updatedAt.toISOString().split('T')[0] : null),
        department: visit.department || 'General Medicine',
        visitType: visit.visitType,
        roomNumber: visit.roomNumber,
      },
      doctor: {
        name: doctorName,
        specialization: doctorSpecialization,
        qualification: doctorQualification,
      },
      vitals: {
        temperature: visit.temperature,
        bloodPressure: visit.bloodPressure,
        pulse: visit.pulse,
        oxygenLevel: visit.oxygenLevel,
        weight: visit.weight,
        height: visit.height,
      },
      diagnosis: diagnosisText,
      chiefComplaint: visit.chiefComplaint,
      medications,
      invoices,
      dischargeNotes: visit.notes || 'No additional discharge notes provided.',
      followUp,
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'EXPORT',
      module: 'patient-visits',
      details: {
        visitId: visit.visitId,
        patientId: visit.patient.patientId,
        patientName: visit.patient.name,
        type: 'discharge-pdf',
      },
      ...extractRequestInfo(request),
    })

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (error) {
    console.error('[DISCHARGE_PDF]', error)
    return NextResponse.json(
      { error: 'Failed to generate discharge summary', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── Follow-up instructions generator ────────────────────────────────────
function generateFollowUpInstructions(
  diagnosis: string,
  medications: Array<{ name: string; dosage: string; frequency: string; duration: string }>
): string[] {
  const lines: string[] = []

  if (medications.length > 0) {
    lines.push('Continue all prescribed medications as directed by your physician.')
    lines.push('Do not stop or change medication dosage without consulting your doctor.')
    const hasDurationMeds = medications.some(m => m.duration)
    if (hasDurationMeds) {
      lines.push('Complete the full course of antibiotics/medications even if you feel better.')
    }
  }

  if (diagnosis && diagnosis !== 'Not specified') {
    lines.push(`Follow-up appointment recommended within 7 days for: ${diagnosis}.`)
  } else {
    lines.push('Follow-up appointment recommended within 7 days.')
  }

  lines.push('Watch for any warning signs such as fever, severe pain, difficulty breathing, or unusual symptoms.')
  lines.push('Maintain adequate hydration and rest as advised.')
  lines.push('In case of emergency, visit the nearest hospital or call emergency services.')
  lines.push('Keep this summary for future reference and show it to your next healthcare provider.')

  return lines
}

// ── HTML Builder ────────────────────────────────────────────────────────
function buildDischargeHtml(data: {
  clinicName: string
  clinicAddress: string
  clinicPhone: string
  clinicEmail: string
  clinicGstin: string
  patient: {
    name: string
    patientId: string
    age: number | null
    gender: string | null
    bloodGroup: string | null
    phone: string
    address: string
  }
  visit: {
    visitId: string
    admissionDate: string
    dischargeDate: string | null
    department: string
    visitType: string
    roomNumber: string | null
  }
  doctor: {
    name: string
    specialization: string
    qualification: string
  }
  vitals: {
    temperature: string | null
    bloodPressure: string | null
    pulse: string | null
    oxygenLevel: string | null
    weight: string | null
    height: string | null
  }
  diagnosis: string
  chiefComplaint: string | null
  medications: Array<{ name: string; dosage: string; frequency: string; duration: string }>
  invoices: Array<{
    invoiceNumber: string
    grandTotal: number
    status: string
    paidAmount: number
    payments: Array<{ amount: number; status: string }>
  }>
  dischargeNotes: string
  followUp: string[]
}): string {
  const { patient, visit, doctor, vitals } = data

  // Vitals grid
  const vitalsEntries = [
    vitals.temperature ? ['Temperature', `${vitals.temperature}°F`] : null,
    vitals.bloodPressure ? ['Blood Pressure', `${vitals.bloodPressure} mmHg`] : null,
    vitals.pulse ? ['Pulse', `${vitals.pulse} bpm`] : null,
    vitals.oxygenLevel ? ['SpO₂', `${vitals.oxygenLevel}%`] : null,
    vitals.weight ? ['Weight', `${vitals.weight} kg`] : null,
    vitals.height ? ['Height', `${vitals.height} cm`] : null,
  ].filter(Boolean) as Array<[string, string]>

  const vitalsHtml = vitalsEntries.length > 0
    ? vitalsEntries.map(([label, value]) => `
        <div style="text-align:center;padding:10px 16px;background:#f9fafb;border-radius:8px;border:1px solid #f3f4f6;">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:4px;">${label}</div>
          <div style="font-size:16px;font-weight:700;color:#1a1a1a;">${value}</div>
        </div>
      `).join('')
    : '<div style="text-align:center;color:#9ca3af;font-size:13px;padding:16px;">No vitals recorded</div>'

  // Medication rows
  const medRows = data.medications.length > 0
    ? data.medications.map((med, idx) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#6b7280;">${idx + 1}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-weight:600;font-size:13px;">${escapeHtml(med.name)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;">${escapeHtml(med.dosage)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;">${escapeHtml(med.frequency)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;">${escapeHtml(med.duration)}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="5" style="padding:16px 12px;text-align:center;color:#9ca3af;font-size:13px;">No prescriptions recorded</td></tr>'

  // Billing summary
  const totalBilled = data.invoices.reduce((sum, inv) => sum + inv.grandTotal, 0)
  const totalPaid = data.invoices.reduce((sum, inv) => sum + inv.paidAmount, 0)
  const totalBalance = totalBilled - totalPaid

  const invoiceRows = data.invoices.length > 0
    ? data.invoices.map(inv => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-family:monospace;font-size:12px;">${escapeHtml(inv.invoiceNumber)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;">${inr(inv.grandTotal)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#059669;font-weight:600;">${inr(inv.paidAmount)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:${inv.paidAmount < inv.grandTotal ? '#dc2626' : '#059669'};font-weight:600;">${inv.status}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="4" style="padding:16px 12px;text-align:center;color:#9ca3af;font-size:13px;">No invoices</td></tr>'

  // Follow-up instructions
  const followUpHtml = data.followUp.map(item => `
    <li style="font-size:13px;color:#4b5563;line-height:1.6;margin-bottom:4px;">${escapeHtml(item)}</li>
  `).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Discharge Summary — ${escapeHtml(patient.name)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #1a1a1a;
      background: #f9fafb;
      line-height: 1.6;
    }
    .page {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      padding: 40px;
      min-height: 100vh;
    }
    @media screen {
      body { padding: 20px; }
      .page { box-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06); border-radius: 8px; }
      .no-print { display: block !important; }
    }
    @media print {
      body { background: #fff; padding: 0; }
      .page { box-shadow: none; padding: 20px 40px; max-width: 100%; }
      .no-print { display: none !important; }
      @page { margin: 15mm 15mm 20mm 15mm; size: A4; }
    }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .clinic-name { font-size: 22px; font-weight: 700; color: #059669; margin-bottom: 2px; }
    .clinic-subtitle { font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 2px; }
    .clinic-info { margin-top: 8px; font-size: 12px; color: #4b5563; line-height: 1.8; }
    .doc-title-box { text-align: right; }
    .doc-title { font-size: 24px; font-weight: 800; color: #1a1a1a; letter-spacing: -0.5px; }
    .doc-subtitle { font-size: 12px; color: #6b7280; margin-top: 4px; }
    .divider { height: 1px; background: #e5e7eb; margin: 20px 0; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #059669; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid #d1fae5; display: inline-block; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .info-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
    .info-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 8px; }
    .info-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
    .info-row-label { color: #6b7280; }
    .info-row-value { font-weight: 600; color: #1a1a1a; }
    .vitals-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f9fafb; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; text-align: left; padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
    td { padding: 8px 12px; }
    .diagnosis-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; }
    .diagnosis-text { font-size: 15px; font-weight: 600; color: #92400e; }
    .complaint-text { font-size: 13px; color: #78716c; margin-top: 6px; }
    .notes-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; font-size: 13px; color: #4b5563; white-space: pre-line; }
    .followup-list { padding-left: 20px; margin-top: 8px; }
    .billing-totals { margin-top: 12px; display: flex; gap: 16px; justify-content: flex-end; }
    .billing-total-item { text-align: right; padding: 8px 16px; border-radius: 6px; }
    .billing-total-item.green { background: #f0fdf4; border: 1px solid #bbf7d0; }
    .billing-total-item.red { background: #fef2f2; border: 1px solid #fecaca; }
    .billing-total-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; }
    .billing-total-value { font-size: 18px; font-weight: 800; }
    .signature-area { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; }
    .signature-block { text-align: center; width: 200px; }
    .signature-line { width: 200px; height: 1px; background: #1a1a1a; margin-bottom: 8px; }
    .signature-name { font-size: 13px; font-weight: 700; color: #1a1a1a; }
    .signature-qual { font-size: 11px; color: #6b7280; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; }
    .footer-text { font-size: 11px; color: #9ca3af; }
    .print-bar { position: fixed; top: 0; left: 0; right: 0; background: #1a1a1a; color: white; padding: 12px 20px; display: flex; align-items: center; justify-content: center; gap: 16px; z-index: 100; }
    .print-bar button { background: #059669; color: white; border: none; padding: 8px 20px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .print-bar button:hover { background: #047857; }
    .print-bar span { font-size: 13px; }
    .page-break { page-break-before: always; }
    @media (max-width: 600px) {
      .two-col { grid-template-columns: 1fr; }
      .vitals-grid { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <div class="no-print print-bar">
    <span>Use Ctrl+P / Cmd+P to save as PDF or print</span>
    <button onclick="window.print()">Print / Save PDF</button>
  </div>

  <div class="page" style="margin-top:60px;">
    <!-- Header -->
    <div class="header">
      <div>
        <div class="clinic-name">${escapeHtml(data.clinicName)}</div>
        <div class="clinic-subtitle">Healthcare Services</div>
        <div class="clinic-info">
          ${data.clinicAddress ? `${escapeHtml(data.clinicAddress)}<br>` : ''}
          ${data.clinicPhone ? `Phone: ${escapeHtml(data.clinicPhone)}` : ''}${data.clinicPhone && data.clinicEmail ? ' | ' : ''}${data.clinicEmail ? `Email: ${escapeHtml(data.clinicEmail)}` : ''}
          ${data.clinicGstin ? `<br>GSTIN: <strong>${escapeHtml(data.clinicGstin)}</strong>` : ''}
        </div>
      </div>
      <div class="doc-title-box">
        <div class="doc-title">Discharge Summary</div>
        <div class="doc-subtitle">${escapeHtml(visit.visitId)} | ${escapeHtml(visit.visitType)}</div>
      </div>
    </div>

    <div class="divider"></div>

    <!-- Patient Demographics -->
    <div class="section">
      <div class="section-title">Patient Information</div>
      <div class="two-col">
        <div class="info-box">
          <div class="info-label">Personal Details</div>
          <div class="info-row"><span class="info-row-label">Name</span><span class="info-row-value">${escapeHtml(patient.name)}</span></div>
          <div class="info-row"><span class="info-row-label">Patient ID</span><span class="info-row-value" style="font-family:monospace;">${escapeHtml(patient.patientId)}</span></div>
          <div class="info-row"><span class="info-row-label">Age / Gender</span><span class="info-row-value">${patient.age ? `${patient.age} yrs` : 'N/A'} / ${patient.gender || 'N/A'}</span></div>
          <div class="info-row"><span class="info-row-label">Blood Group</span><span class="info-row-value">${patient.bloodGroup || 'N/A'}</span></div>
          <div class="info-row"><span class="info-row-label">Phone</span><span class="info-row-value">${escapeHtml(patient.phone)}</span></div>
        </div>
        <div class="info-box">
          <div class="info-label">Visit Details</div>
          <div class="info-row"><span class="info-row-label">Department</span><span class="info-row-value">${escapeHtml(visit.department)}</span></div>
          <div class="info-row"><span class="info-row-label">Visit Type</span><span class="info-row-value">${escapeHtml(visit.visitType)}</span></div>
          ${visit.roomNumber ? `<div class="info-row"><span class="info-row-label">Room No.</span><span class="info-row-value">${escapeHtml(visit.roomNumber)}</span></div>` : ''}
          <div class="info-row"><span class="info-row-label">Admission</span><span class="info-row-value">${formatDate(visit.admissionDate)}</span></div>
          <div class="info-row"><span class="info-row-label">Discharge</span><span class="info-row-value">${formatDate(visit.dischargeDate)}</span></div>
          <div class="info-row"><span class="info-row-label">Attending Doctor</span><span class="info-row-value">${escapeHtml(doctor.name)}</span></div>
        </div>
      </div>
    </div>

    <!-- Vitals at Admission -->
    <div class="section">
      <div class="section-title">Vitals at Admission</div>
      <div class="vitals-grid">
        ${vitalsHtml}
      </div>
    </div>

    <!-- Diagnosis / Chief Complaint -->
    <div class="section">
      <div class="section-title">Diagnosis</div>
      <div class="diagnosis-box">
        <div class="diagnosis-text">${escapeHtml(data.diagnosis)}</div>
        ${data.chiefComplaint && data.chiefComplaint !== data.diagnosis ? `<div class="complaint-text"><strong>Chief Complaint:</strong> ${escapeHtml(data.chiefComplaint)}</div>` : ''}
      </div>
    </div>

    <!-- Prescriptions -->
    <div class="section">
      <div class="section-title">Prescriptions</div>
      <table>
        <thead>
          <tr>
            <th style="width:40px;text-align:center;">#</th>
            <th>Medicine</th>
            <th>Dosage</th>
            <th>Frequency</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          ${medRows}
        </tbody>
      </table>
    </div>

    <!-- Billing Summary -->
    <div class="section">
      <div class="section-title">Billing Summary</div>
      <table>
        <thead>
          <tr>
            <th>Invoice</th>
            <th style="text-align:right;">Total</th>
            <th style="text-align:right;">Paid</th>
            <th style="text-align:right;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${invoiceRows}
        </tbody>
      </table>
      <div class="billing-totals">
        <div class="billing-total-item green">
          <div class="billing-total-label">Total Billed</div>
          <div class="billing-total-value" style="color:#059669;">${inr(totalBilled)}</div>
        </div>
        <div class="billing-total-item green">
          <div class="billing-total-label">Total Paid</div>
          <div class="billing-total-value" style="color:#059669;">${inr(totalPaid)}</div>
        </div>
        <div class="billing-total-item ${totalBalance > 0 ? 'red' : 'green'}">
          <div class="billing-total-label">Balance Due</div>
          <div class="billing-total-value" style="color:${totalBalance > 0 ? '#dc2626' : '#059669'};">${inr(totalBalance)}</div>
        </div>
      </div>
    </div>

    <!-- Discharge Notes / Treatment Summary -->
    <div class="section">
      <div class="section-title">Treatment Summary &amp; Discharge Notes</div>
      <div class="notes-box">${escapeHtml(data.dischargeNotes)}</div>
    </div>

    <!-- Follow-up Instructions -->
    <div class="section">
      <div class="section-title">Follow-up Instructions</div>
      <ol class="followup-list">
        ${followUpHtml}
      </ol>
    </div>

    <!-- Signature Area -->
    <div class="signature-area">
      <div>
        <div style="font-size:11px;color:#9ca3af;">Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
      </div>
      <div class="signature-block">
        <div class="signature-line"></div>
        <div class="signature-name">${escapeHtml(doctor.name)}</div>
        <div class="signature-qual">${escapeHtml(doctor.qualification)}${doctor.qualification && doctor.specialization ? ', ' : ''}${escapeHtml(doctor.specialization)}</div>
        <div class="signature-qual">Attending Physician</div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-text">This is a computer-generated discharge summary and does not require a physical signature.</div>
      <div class="footer-text" style="margin-top:4px;">Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  </div>
</body>
</html>`
}

// ── Helpers ─────────────────────────────────────────────────────────────
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}