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

// ── Helper: Amount to words (Indian Rupees) ────────────────────────────
function amountToWords(num: number): string {
  if (num === 0) return 'Zero Rupees Only'

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ]
  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
  ]

  function convert(n: number): string {
    if (n < 20) return ones[n]
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '')
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + convert(n % 100) : '')
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '')
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + convert(n % 100000) : '')
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + convert(n % 10000000) : '')
  }

  const rupees = Math.floor(num)
  const paise = Math.round((num - rupees) * 100)
  let result = convert(rupees) + ' Rupees'
  if (paise > 0) {
    result += ' and ' + convert(paise) + ' Paise'
  }
  result += ' Only'
  return result
}

// ── Helper: Generate receipt number if null ────────────────────────────
async function ensureReceiptNumber(paymentId: string, existingReceiptNumber: string | null): Promise<string> {
  if (existingReceiptNumber) return existingReceiptNumber

  // Generate RCP-YYYYMMDD-NNN
  const today = new Date()
  const datePart = today.getFullYear().toString() +
    String(today.getMonth() + 1).padStart(2, '0') +
    String(today.getDate()).padStart(2, '0')
  const prefix = `RCP-${datePart}-`

  // Count existing receipts with this prefix today
  const count = await db.payment.count({
    where: {
      receiptNumber: { startsWith: prefix },
    },
  })

  const receiptNumber = `${prefix}${String(count + 1).padStart(3, '0')}`

  // Persist the generated receipt number
  await db.payment.update({
    where: { id: paymentId },
    data: { receiptNumber },
  })

  return receiptNumber
}

// ── Helper: Format date/time ───────────────────────────────────────────
function formatDateTime(dt: Date): string {
  return dt.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(dateStr: string): string {
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
  const auth = await authenticateRequest(request, '/api/payments')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 })
    }

    // Fetch payment with invoice and patient
    const payment = await db.payment.findUnique({
      where: { id },
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            grandTotal: true,
            paidAmount: true,
            status: true,
          },
        },
        patient: {
          select: {
            name: true,
            patientId: true,
            phone: true,
          },
        },
      },
    })

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Ensure receipt number exists
    const receiptNumber = await ensureReceiptNumber(payment.id, payment.receiptNumber)

    // Fetch clinic settings
    const clinic = await db.clinicSettings.findFirst()
    const clinicName = clinic?.clinicName || 'Hospital / Clinic'
    const clinicAddress = [clinic?.address, clinic?.city, clinic?.state, clinic?.pincode].filter(Boolean).join(', ')
    const clinicPhone = clinic?.phone || ''
    const clinicEmail = clinic?.email || ''
    const clinicGstin = clinic?.gstin || ''

    // Build HTML
    const html = buildReceiptHtml({
      clinicName,
      clinicAddress,
      clinicPhone,
      clinicEmail,
      clinicGstin,
      receiptNumber,
      payment,
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'EXPORT',
      module: 'payments',
      details: {
        paymentId: id,
        paymentIdCode: payment.paymentId,
        receiptNumber,
        amount: payment.amount,
        type: 'receipt-html',
      },
      ...extractRequestInfo(request),
    })

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (error) {
    console.error('[PAYMENT_RECEIPT]', error)
    return NextResponse.json(
      { error: 'Failed to generate receipt', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── HTML Builder ────────────────────────────────────────────────────────
function buildReceiptHtml(data: {
  clinicName: string
  clinicAddress: string
  clinicPhone: string
  clinicEmail: string
  clinicGstin: string
  receiptNumber: string
  payment: {
    paymentId: string
    amount: number
    method: string
    status: string
    razorpayPaymentId: string | null
    razorpayOrderId: string | null
    upiVpa: string | null
    upiTransactionId: string | null
    paypalCaptureId: string | null
    createdAt: Date
    invoice: {
      invoiceNumber: string
      grandTotal: number
      paidAmount: number
      status: string
    }
    patient: {
      name: string
      patientId: string
      phone: string
    }
  }
}): string {
  const pay = data.payment

  // Method-specific details
  let methodDetails = ''
  if (pay.upiVpa) {
    methodDetails += `<div style="font-size:12px;color:#4b5563;">UPI VPA: <span style="font-family:monospace;font-weight:600;">${escapeHtml(pay.upiVpa)}</span></div>`
  }
  if (pay.upiTransactionId) {
    methodDetails += `<div style="font-size:12px;color:#4b5563;">UPI Txn ID: <span style="font-family:monospace;">${escapeHtml(pay.upiTransactionId)}</span></div>`
  }
  if (pay.razorpayPaymentId) {
    methodDetails += `<div style="font-size:12px;color:#4b5563;">Razorpay Pay ID: <span style="font-family:monospace;">${escapeHtml(pay.razorpayPaymentId)}</span></div>`
  }
  if (pay.razorpayOrderId) {
    methodDetails += `<div style="font-size:12px;color:#4b5563;">Razorpay Order ID: <span style="font-family:monospace;">${escapeHtml(pay.razorpayOrderId)}</span></div>`
  }
  if (pay.paypalCaptureId) {
    methodDetails += `<div style="font-size:12px;color:#4b5563;">PayPal Capture ID: <span style="font-family:monospace;">${escapeHtml(pay.paypalCaptureId)}</span></div>`
  }

  const methodIcon = getMethodEmoji(pay.method)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Receipt — ${escapeHtml(data.receiptNumber)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #1a1a1a;
      background: #f9fafb;
      line-height: 1.6;
    }
    .receipt-page {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      padding: 48px 40px;
      min-height: 100vh;
      position: relative;
    }
    @media screen {
      body { padding: 20px; }
      .receipt-page { box-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06); border-radius: 8px; }
      .no-print { display: block !important; }
    }
    @media print {
      body { background: #fff; padding: 0; }
      .receipt-page { box-shadow: none; padding: 24px 40px; max-width: 100%; }
      .no-print { display: none !important; }
      @page { margin: 15mm 15mm 20mm 15mm; size: A5 portrait; }
    }
    .header { text-align: center; margin-bottom: 32px; }
    .clinic-name { font-size: 24px; font-weight: 700; color: #059669; margin-bottom: 2px; }
    .clinic-subtitle { font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 2px; }
    .clinic-info { margin-top: 12px; font-size: 12px; color: #6b7280; line-height: 1.8; }
    .receipt-label { text-align: center; margin: 24px 0 20px; position: relative; }
    .receipt-label-text { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 3px; color: #9ca3af; background: #fff; display: inline-block; padding: 0 16px; position: relative; z-index: 1; }
    .receipt-label::before { content:''; position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: #e5e7eb; z-index: 0; }
    .receipt-number { text-align: center; margin-bottom: 28px; }
    .receipt-number-value { font-size: 22px; font-weight: 800; color: #1a1a1a; font-family: monospace; letter-spacing: 1px; }
    .amount-box { text-align: center; margin: 28px 0; padding: 28px 20px; background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border: 2px solid #bbf7d0; border-radius: 12px; }
    .amount-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #059669; margin-bottom: 8px; }
    .amount-value { font-size: 36px; font-weight: 800; color: #059669; }
    .amount-words { font-size: 13px; color: #065f46; margin-top: 8px; font-style: italic; }
    .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0; }
    .detail-item { padding: 12px 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #f3f4f6; }
    .detail-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 4px; }
    .detail-value { font-size: 14px; font-weight: 600; color: #1a1a1a; }
    .detail-value-mono { font-family: monospace; }
    .method-section { margin: 24px 0; padding: 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; }
    .method-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .method-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; background: #dbeafe; color: #1e40af; font-size: 13px; font-weight: 600; }
    .method-details { margin-top: 8px; }
    .success-check { text-align: center; margin: 20px 0; }
    .check-icon { width: 48px; height: 48px; border-radius: 50%; background: #d1fae5; display: inline-flex; align-items: center; justify-content: center; }
    .check-svg { width: 28px; height: 28px; stroke: #059669; fill: none; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
    .divider { height: 1px; background: #e5e7eb; margin: 24px 0; }
    .footer { margin-top: 32px; text-align: center; }
    .footer-thanks { font-size: 16px; font-weight: 600; color: #059669; margin-bottom: 8px; }
    .footer-sub { font-size: 12px; color: #9ca3af; }
    .footer-gen { font-size: 10px; color: #d1d5db; margin-top: 12px; }
    .print-bar { position: fixed; top: 0; left: 0; right: 0; background: #1a1a1a; color: white; padding: 12px 20px; display: flex; align-items: center; justify-content: center; gap: 16px; z-index: 100; }
    .print-bar button { background: #059669; color: white; border: none; padding: 8px 20px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .print-bar button:hover { background: #047857; }
    .print-bar span { font-size: 13px; }
    @media (max-width: 500px) {
      .details-grid { grid-template-columns: 1fr; }
      .amount-value { font-size: 28px; }
    }
  </style>
</head>
<body>
  <div class="no-print print-bar">
    <span>Use Ctrl+P / Cmd+P to save as PDF or print</span>
    <button onclick="window.print()">Print / Save PDF</button>
  </div>

  <div class="receipt-page" style="margin-top:60px;">
    <!-- Header -->
    <div class="header">
      <div class="clinic-name">${escapeHtml(data.clinicName)}</div>
      <div class="clinic-subtitle">Payment Receipt</div>
      <div class="clinic-info">
        ${data.clinicAddress ? `${escapeHtml(data.clinicAddress)}<br>` : ''}
        ${data.clinicPhone ? `Phone: ${escapeHtml(data.clinicPhone)}` : ''}${data.clinicPhone && data.clinicEmail ? ' | ' : ''}${data.clinicEmail ? `Email: ${escapeHtml(data.clinicEmail)}` : ''}
        ${data.clinicGstin ? `<br>GSTIN: <strong>${escapeHtml(data.clinicGstin)}</strong>` : ''}
      </div>
    </div>

    <div class="divider"></div>

    <!-- Receipt Number -->
    <div class="receipt-number">
      <div class="detail-label">Receipt Number</div>
      <div class="receipt-number-value">${escapeHtml(data.receiptNumber)}</div>
    </div>

    <!-- Success Check -->
    <div class="success-check">
      <div class="check-icon">
        <svg class="check-svg" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </div>
    </div>

    <!-- Amount -->
    <div class="amount-box">
      <div class="amount-label">Amount Received</div>
      <div class="amount-value">${inr(pay.amount)}</div>
      <div class="amount-words">${amountToWords(pay.amount)}</div>
    </div>

    <!-- Details Grid -->
    <div class="details-grid">
      <div class="detail-item">
        <div class="detail-label">Patient Name</div>
        <div class="detail-value">${escapeHtml(pay.patient.name)}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Patient ID</div>
        <div class="detail-value detail-value-mono">${escapeHtml(pay.patient.patientId)}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Payment Date</div>
        <div class="detail-value">${formatDateTime(pay.createdAt)}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Invoice</div>
        <div class="detail-value detail-value-mono">${escapeHtml(pay.invoice.invoiceNumber)}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Payment ID</div>
        <div class="detail-value detail-value-mono">${escapeHtml(pay.paymentId)}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Invoice Total</div>
        <div class="detail-value">${inr(pay.invoice.grandTotal)}</div>
      </div>
    </div>

    <!-- Payment Method -->
    <div class="method-section">
      <div class="method-header">
        <span class="detail-label" style="margin:0;">Payment Method</span>
      </div>
      <div class="method-badge">${methodIcon} ${escapeHtml(pay.method)}</div>
      ${methodDetails ? `<div class="method-details" style="margin-top:12px;">${methodDetails}</div>` : ''}
    </div>

    <!-- Status -->
    <div style="text-align:center;margin:20px 0;">
      <span style="display:inline-block;padding:4px 16px;border-radius:20px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;background:${pay.status === 'Success' ? '#d1fae5' : pay.status === 'Refunded' ? '#fee2e2' : '#fef3c7'};color:${pay.status === 'Success' ? '#065f46' : pay.status === 'Refunded' ? '#991b1b' : '#92400e'};">${escapeHtml(pay.status)}</span>
    </div>

    <div class="divider"></div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-thanks">Thank you for your payment!</div>
      <div class="footer-sub">Please retain this receipt for your records.</div>
      <div class="footer-gen">Computer-generated receipt — Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
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

function getMethodEmoji(method: string): string {
  switch (method.toLowerCase()) {
    case 'cash': return '💵'
    case 'upi': return '📱'
    case 'card': return '💳'
    case 'net banking': return '🏦'
    case 'wallet': return '👛'
    case 'razorpay': return '⚡'
    default: return '💰'
  }
}