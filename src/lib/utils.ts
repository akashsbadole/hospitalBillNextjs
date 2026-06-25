import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// GST calculation utilities for Indian tax system

export const GST_SLABS = [0, 5, 12, 18, 28] as const
export type GstSlab = (typeof GST_SLABS)[number]

// HSN/SAC codes for medical services
export const HSN_CODES: Record<string, string> = {
  // Medical Services (SAC codes)
  consultation: '0011',
  followup: '0011',
  emergency: '0012',
  // Lab Tests
  bloodTest: '0013',
  xray: '0014',
  ultrasound: '0015',
  mri: '0016',
  ctScan: '0017',
  ecg: '0018',
  pathology: '0019',
  // Pharmacy
  medicine: '3004',
  surgical: '9018',
  equipment: '9019',
  // Room Charges
  roomGeneral: '0010',
  roomPrivate: '0010',
  icu: '0010',
  // Packages
  healthCheckup: '0020',
  dental: '0021',
  eye: '0022',
}

export function calculateGST(
  amount: number,
  gstRate: number,
  isInterstate: boolean = false
): { cgst: number; sgst: number; igst: number; totalGst: number; grandTotal: number } {
  const gstAmount = (amount * gstRate) / 100

  if (isInterstate) {
    return {
      cgst: 0,
      sgst: 0,
      igst: parseFloat(gstAmount.toFixed(2)),
      totalGst: parseFloat(gstAmount.toFixed(2)),
      grandTotal: parseFloat((amount + gstAmount).toFixed(2)),
    }
  }

  const halfGst = parseFloat((gstAmount / 2).toFixed(2))
  return {
    cgst: halfGst,
    sgst: halfGst,
    igst: 0,
    totalGst: parseFloat(gstAmount.toFixed(2)),
    grandTotal: parseFloat((amount + gstAmount).toFixed(2)),
  }
}

export function calculateInvoiceGST(items: Array<{
  unitPrice: number
  quantity: number
  gstRate: number
}>): { subtotal: number; totalGst: number; cgst: number; sgst: number; igst: number; grandTotal: number } {
  let subtotal = 0
  let totalCgst = 0
  let totalSgst = 0
  let totalIgst = 0

  for (const item of items) {
    const lineTotal = item.unitPrice * item.quantity
    subtotal += lineTotal
    const gst = calculateGST(lineTotal, item.gstRate)
    totalCgst += gst.cgst
    totalSgst += gst.sgst
    totalIgst += gst.igst
  }

  const totalGst = parseFloat((totalCgst + totalSgst + totalIgst).toFixed(2))
  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    totalGst,
    cgst: parseFloat(totalCgst.toFixed(2)),
    sgst: parseFloat(totalSgst.toFixed(2)),
    igst: parseFloat(totalIgst.toFixed(2)),
    grandTotal: parseFloat((subtotal + totalGst).toFixed(2)),
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function validateGSTIN(gstin: string): boolean {
  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
  return regex.test(gstin)
}

// Invoice number generator
export function generateInvoiceNumber(lastNumber: string | null): string {
  if (!lastNumber) return 'INV-0001'
  const num = parseInt(lastNumber.replace('INV-', ''), 10)
  return `INV-${String(num + 1).padStart(4, '0')}`
}

// Patient ID generator
export function generatePatientId(lastNumber: string | null): string {
  if (!lastNumber) return 'PAT-0001'
  const num = parseInt(lastNumber.replace('PAT-', ''), 10)
  return `PAT-${String(num + 1).padStart(4, '0')}`
}

// Doctor ID generator
export function generateDoctorId(lastNumber: string | null): string {
  if (!lastNumber) return 'DOC-0001'
  const num = parseInt(lastNumber.replace('DOC-', ''), 10)
  return `DOC-${String(num + 1).padStart(4, '0')}`
}

// Appointment ID generator
export function generateAppointmentId(lastNumber: string | null): string {
  if (!lastNumber) return 'APT-0001'
  const num = parseInt(lastNumber.replace('APT-', ''), 10)
  return `APT-${String(num + 1).padStart(4, '0')}`
}

// Payment ID generator
export function generatePaymentId(lastNumber: string | null): string {
  if (!lastNumber) return 'PAY-0001'
  const num = parseInt(lastNumber.replace('PAY-', ''), 10)
  return `PAY-${String(num + 1).padStart(4, '0')}`
}

// Prescription ID generator
export function generatePrescriptionId(lastNumber: string | null): string {
  if (!lastNumber) return 'PRX-0001'
  const num = parseInt(lastNumber.replace('PRX-', ''), 10)
  return `PRX-${String(num + 1).padStart(4, '0')}`
}

// Medicine ID generator
export function generateMedicineId(lastNumber: string | null): string {
  if (!lastNumber) return 'MED-0001'
  const num = parseInt(lastNumber.replace('MED-', ''), 10)
  return `MED-${String(num + 1).padStart(4, '0')}`
}

// Staff ID generator
export function generateStaffId(lastNumber: string | null): string {
  if (!lastNumber) return 'STF-0001'
  const num = parseInt(lastNumber.replace('STF-', ''), 10)
  return `STF-${String(num + 1).padStart(4, '0')}`
}

// Visit ID generator
export function generateVisitId(lastNumber: string | null): string {
  if (!lastNumber) return 'VIS-0001'
  const num = parseInt(lastNumber.replace('VIS-', ''), 10)
  return `VIS-${String(num + 1).padStart(4, '0')}`
}

// Support Ticket ID generator
export function generateSupportTicketId(lastNumber: string | null): string {
  if (!lastNumber) return 'TKT-0001'
  const num = parseInt(lastNumber.replace('TKT-', ''), 10)
  return `TKT-${String(num + 1).padStart(4, '0')}`
}

// Call Session ID generator
export function generateCallSessionId(lastNumber: string | null): string {
  if (!lastNumber) return 'CALL-0001'
  const num = parseInt(lastNumber.replace('CALL-', ''), 10)
  return `CALL-${String(num + 1).padStart(4, '0')}`
}

// Insurance Company ID generator
export function generateInsuranceCompanyId(lastNumber: string | null): string {
  if (!lastNumber) return 'INS-0001'
  const num = parseInt(lastNumber.replace('INS-', ''), 10)
  return `INS-${String(num + 1).padStart(4, '0')}`
}

// Insurance Claim ID generator
export function generateClaimId(lastNumber: string | null): string {
  if (!lastNumber) return 'CLM-0001'
  const num = parseInt(lastNumber.replace('CLM-', ''), 10)
  return `CLM-${String(num + 1).padStart(4, '0')}`
}

// Lab Test ID generator
export function generateLabTestId(lastNumber: string | null): string {
  if (!lastNumber) return 'LT-0001'
  const num = parseInt(lastNumber.replace('LT-', ''), 10)
  return `LT-${String(num + 1).padStart(4, '0')}`
}

// Lab Test Order ID generator
export function generateLabTestOrderId(lastNumber: string | null): string {
  if (!lastNumber) return 'LTO-0001'
  const num = parseInt(lastNumber.replace('LTO-', ''), 10)
  return `LTO-${String(num + 1).padStart(4, '0')}`
}

// Imaging Study ID generator
export function generateImagingStudyId(lastNumber: string | null): string {
  if (!lastNumber) return 'IMG-0001'
  const num = parseInt(lastNumber.replace('IMG-', ''), 10)
  return `IMG-${String(num + 1).padStart(4, '0')}`
}

// Purchase Order ID generator
export function generatePurchaseOrderId(lastNumber: string | null): string {
  if (!lastNumber) return 'PO-0001'
  const num = parseInt(lastNumber.replace('PO-', ''), 10)
  return `PO-${String(num + 1).padStart(4, '0')}`
}

// Stock Movement ID generator
export function generateStockMovementId(lastNumber: string | null): string {
  if (!lastNumber) return 'SM-0001'
  const num = parseInt(lastNumber.replace('SM-', ''), 10)
  return `SM-${String(num + 1).padStart(4, '0')}`
}

// Queue Token ID generator
export function generateQueueTokenId(lastNumber: string | null): string {
  if (!lastNumber) return 'Q-0001'
  const num = parseInt(lastNumber.replace('Q-', ''), 10)
  return `Q-${String(num + 1).padStart(4, '0')}`
}

// Branch ID generator
export function generateBranchId(lastNumber: string | null): string {
  if (!lastNumber) return 'BRN-0001'
  const num = parseInt(lastNumber.replace('BRN-', ''), 10)
  return `BRN-${String(num + 1).padStart(4, '0')}`
}

// Barcode Scan ID generator
export function generateScanId(lastNumber: string | null): string {
  if (!lastNumber) return 'SCN-0001'
  const num = parseInt(lastNumber.replace('SCN-', ''), 10)
  return `SCN-${String(num + 1).padStart(4, '0')}`
}

// Role badge color utility
export function getRoleBadgeColor(role: string): string {
  switch (role) {
    case 'Admin': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
    case 'Doctor': return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
    case 'Receptionist': return 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800'
    case 'Accountant': return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
    case 'Pharmacist': return 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800'
    default: return 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-950/40 dark:text-gray-400 dark:border-gray-800'
  }
}

// Payroll ID generator
export function generatePayrollId(lastNumber: string | null): string {
  if (!lastNumber) return 'PAYR-0001'
  const num = parseInt(lastNumber.replace('PAYR-', ''), 10)
  return `PAYR-${String(num + 1).padStart(4, '0')}`
}

// Shift ID generator
export function generateShiftId(lastNumber: string | null): string {
  if (!lastNumber) return 'SFT-0001'
  const num = parseInt(lastNumber.replace('SFT-', ''), 10)
  return `SFT-${String(num + 1).padStart(4, '0')}`
}

// Leave ID generator
export function generateLeaveId(lastNumber: string | null): string {
  if (!lastNumber) return 'LEV-0001'
  const num = parseInt(lastNumber.replace('LEV-', ''), 10)
  return `LEV-${String(num + 1).padStart(4, '0')}`
}

// Insurance Policy ID generator
export function generatePolicyId(lastNumber: string | null): string {
  if (!lastNumber) return 'POL-0001'
  const num = parseInt(lastNumber.replace('POL-', ''), 10)
  return `POL-${String(num + 1).padStart(4, '0')}`
}

// Pre-Auth ID generator
export function generatePreAuthId(lastNumber: string | null): string {
  if (!lastNumber) return 'PRA-0001'
  const num = parseInt(lastNumber.replace('PRA-', ''), 10)
  return `PRA-${String(num + 1).padStart(4, '0')}`
}

// WhatsApp Message ID generator
export function generateWhatsAppId(lastNumber: string | null): string {
  if (!lastNumber) return 'WAM-0001'
  const num = parseInt(lastNumber.replace('WAM-', ''), 10)
  return `WAM-${String(num + 1).padStart(4, '0')}`
}

// Discharge Summary ID generator
export function generateDischargeId(lastNumber: string | null): string {
  if (!lastNumber) return 'DCS-0001'
  const num = parseInt(lastNumber.replace('DCS-', ''), 10)
  return `DCS-${String(num + 1).padStart(4, '0')}`
}

// Diet Order ID generator
export function generateDietOrderId(lastNumber: string | null): string {
  if (!lastNumber) return 'DIT-0001'
  const num = parseInt(lastNumber.replace('DIT-', ''), 10)
  return `DIT-${String(num + 1).padStart(4, '0')}`
}

// Pharmacy Sale ID generator
export function generatePharmacySaleId(lastNumber: string | null): string {
  if (!lastNumber) return 'PSA-0001'
  const num = parseInt(lastNumber.replace('PSA-', ''), 10)
  return `PSA-${String(num + 1).padStart(4, '0')}`
}

// Camp ID generator
export function generateCampId(lastNumber: string | null): string {
  if (!lastNumber) return 'CAMP-0001'
  const num = parseInt(lastNumber.replace('CAMP-', ''), 10)
  return `CAMP-${String(num + 1).padStart(4, '0')}`
}

// Camp Registration ID generator
export function generateCampRegId(lastNumber: string | null): string {
  if (!lastNumber) return 'CREG-0001'
  const num = parseInt(lastNumber.replace('CREG-', ''), 10)
  return `CREG-${String(num + 1).padStart(4, '0')}`
}

// Asset ID generator
export function generateAssetId(lastNumber: string | null): string {
  if (!lastNumber) return 'AST-0001'
  const num = parseInt(lastNumber.replace('AST-', ''), 10)
  return `AST-${String(num + 1).padStart(4, '0')}`
}

// Analytics Report ID generator
export function generateReportId(lastNumber: string | null): string {
  if (!lastNumber) return 'RPT-0001'
  const num = parseInt(lastNumber.replace('RPT-', ''), 10)
  return `RPT-${String(num + 1).padStart(4, '0')}`
}

// HL7 Message ID generator
export function generateHl7MessageId(lastNumber: string | null): string {
  if (!lastNumber) return 'HL7-0001'
  const num = parseInt(lastNumber.replace('HL7-', ''), 10)
  return `HL7-${String(num + 1).padStart(4, '0')}`
}

// Compliance Standard ID generator
export function generateComplianceStandardId(lastNumber: string | null): string {
  if (!lastNumber) return 'STD-0001'
  const num = parseInt(lastNumber.replace('STD-', ''), 10)
  return `STD-${String(num + 1).padStart(4, '0')}`
}

// Compliance Checklist ID generator
export function generateComplianceChecklistId(lastNumber: string | null): string {
  if (!lastNumber) return 'CHK-0001'
  const num = parseInt(lastNumber.replace('CHK-', ''), 10)
  return `CHK-${String(num + 1).padStart(4, '0')}`
}

// Compliance Audit ID generator
export function generateComplianceAuditId(lastNumber: string | null): string {
  if (!lastNumber) return 'AUD-0001'
  const num = parseInt(lastNumber.replace('AUD-', ''), 10)
  return `AUD-${String(num + 1).padStart(4, '0')}`
}
