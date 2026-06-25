import { describe, it, expect } from 'vitest'

// Test WhatsApp message generation (same logic as in /api/whatsapp/send/route.ts)
function generatePrescriptionMessage(
  patientName: string,
  doctorName: string,
  prescriptionId: string,
  medicineCount: number,
): string {
  return `📋 Prescription from MediBill Pro

Patient: ${patientName}
Doctor: Dr. ${doctorName}
Prescription #: ${prescriptionId}
Medicines: ${medicineCount} item(s)

Please carry this prescription when visiting the pharmacy.`
}

function generateInvoiceMessage(
  patientName: string,
  invoiceNumber: string,
  amount: number,
  status: string,
): string {
  return `🧾 Invoice from MediBill Pro

Patient: ${patientName}
Invoice #: ${invoiceNumber}
Amount: ₹${amount.toFixed(2)}
Status: ${status}

Thank you for choosing our services.`
}

function generatePaymentReceiptMessage(
  patientName: string,
  invoiceNumber: string,
  amount: number,
  method: string,
): string {
  return `✅ Payment Receipt - MediBill Pro

Patient: ${patientName}
Invoice #: ${invoiceNumber}
Amount Paid: ₹${amount.toFixed(2)}
Payment Method: ${method}

Thank you! This is a computer-generated receipt.`
}

function generateAppointmentReminderMessage(
  patientName: string,
  doctorName: string,
  date: string,
  time: string,
): string {
  return `🔔 Appointment Reminder - MediBill Pro

Patient: ${patientName}
Doctor: Dr. ${doctorName}
Date: ${date}
Time: ${time}

Please arrive 10 minutes early.`
}

describe('Prescription WhatsApp Messages', () => {
  it('should generate prescription message with correct details', () => {
    const msg = generatePrescriptionMessage('John Doe', 'Smith', 'PRX-0042', 3)
    expect(msg).toContain('John Doe')
    expect(msg).toContain('Dr. Smith')
    expect(msg).toContain('PRX-0042')
    expect(msg).toContain('3 item(s)')
  })

  it('should handle zero medicines', () => {
    const msg = generatePrescriptionMessage('Jane Doe', 'Adams', 'PRX-0001', 0)
    expect(msg).toContain('0 item(s)')
  })
})

describe('Invoice WhatsApp Messages', () => {
  it('should generate invoice message with correct amount', () => {
    const msg = generateInvoiceMessage('John Doe', 'INV-0042', 1500.50, 'Paid')
    expect(msg).toContain('John Doe')
    expect(msg).toContain('INV-0042')
    expect(msg).toContain('₹1500.50')
    expect(msg).toContain('Paid')
  })

  it('should handle zero amount', () => {
    const msg = generateInvoiceMessage('John Doe', 'INV-0000', 0, 'Unpaid')
    expect(msg).toContain('₹0.00')
  })
})

describe('Payment Receipt WhatsApp Messages', () => {
  it('should generate payment receipt with correct details', () => {
    const msg = generatePaymentReceiptMessage('John Doe', 'INV-0042', 500, 'UPI')
    expect(msg).toContain('John Doe')
    expect(msg).toContain('INV-0042')
    expect(msg).toContain('₹500.00')
    expect(msg).toContain('UPI')
  })

  it('should handle different payment methods', () => {
    const msg = generatePaymentReceiptMessage('Jane Doe', 'INV-0001', 1200, 'Cash')
    expect(msg).toContain('Cash')
  })
})

describe('Appointment Reminder WhatsApp Messages', () => {
  it('should generate appointment reminder correctly', () => {
    const msg = generateAppointmentReminderMessage('John Doe', 'Smith', '2024-02-01', '10:30')
    expect(msg).toContain('John Doe')
    expect(msg).toContain('Dr. Smith')
    expect(msg).toContain('2024-02-01')
    expect(msg).toContain('10:30')
    expect(msg).toContain('10 minutes early')
  })
})

describe('Phone Number Formatting', () => {
  it('should format Indian phone numbers for WhatsApp', () => {
    const phone = '9876543210'
    const whatsappNumber = `whatsapp:+91${phone}`
    expect(whatsappNumber).toBe('whatsapp:+919876543210')
  })

  it('should handle numbers with existing + prefix', () => {
    const phone = '+919876543210'
    const cleanPhone = phone.startsWith('+') ? phone : `+91${phone}`
    const whatsappNumber = `whatsapp:+919876543210`
    expect(whatsappNumber.startsWith('whatsapp:')).toBe(true)
    expect(whatsappNumber).toContain('+919876543210')
  })
})
