import { apiPost } from './api-client'

interface SendWhatsAppParams {
  to: string
  template: 'prescription' | 'invoice' | 'appointment_reminder' | 'payment_receipt' | 'lab_report'
  entityType: string
  entityId: string
  messageBody: string
  mediaUrl?: string
  onSuccess?: (result: { messageId: string }) => void
  onError?: (error: string) => void
}

export async function sendWhatsApp(params: SendWhatsAppParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const res = await apiPost('/api/whatsapp/send', {
      to: params.to,
      template: params.template,
      entityType: params.entityType,
      entityId: params.entityId,
      messageBody: params.messageBody,
      mediaUrl: params.mediaUrl,
    })
    const data = res as { success: boolean; messageId?: string; error?: string }
    if (data.success) {
      params.onSuccess?.({ messageId: data.messageId || '' })
    } else {
      params.onError?.(data.error || 'Failed to send message')
    }
    return data
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to send WhatsApp message'
    params.onError?.(msg)
    return { success: false, error: msg }
  }
}

export function formatPrescriptionMessage(patientName: string, doctorName: string, prescriptionId: string, medicineCount: number): string {
  return `📋 Prescription from MediBill Pro

Patient: ${patientName}
Doctor: Dr. ${doctorName}
Prescription #: ${prescriptionId}
Medicines: ${medicineCount} item(s)

Please carry this prescription when visiting the pharmacy.`
}

export function formatInvoiceMessage(patientName: string, invoiceNumber: string, amount: number, status: string): string {
  return `🧾 Invoice from MediBill Pro

Patient: ${patientName}
Invoice #: ${invoiceNumber}
Amount: Rs.${amount.toFixed(2)}
Status: ${status}

Thank you for choosing our services.`
}

export function formatPaymentReceiptMessage(patientName: string, invoiceNumber: string, amount: number, method: string): string {
  return `✅ Payment Receipt - MediBill Pro

Patient: ${patientName}
Invoice #: ${invoiceNumber}
Amount Paid: Rs.${amount.toFixed(2)}
Payment Method: ${method}

Thank you! This is a computer-generated receipt.`
}
