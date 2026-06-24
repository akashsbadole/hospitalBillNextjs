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

// ── Helper: Format date ────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function formatDateTime(dt: string): string {
  const date = new Date(dt)
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/billing')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 })
    }

    // Fetch invoice with items, payments, patient
    const invoice = await db.invoice.findUnique({
      where: { id },
      include: {
        patient: true,
        items: { orderBy: { id: 'asc' } },
        payments: { where: { status: 'Success' }, orderBy: { createdAt: 'desc' } },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Fetch clinic settings
    const clinic = await db.clinicSettings.findFirst()
    const clinicName = clinic?.clinicName || 'Hospital / Clinic'
    const clinicAddress = [clinic?.address, clinic?.city, clinic?.state, clinic?.pincode].filter(Boolean).join(', ')
    const clinicPhone = clinic?.phone || ''
    const clinicEmail = clinic?.email || ''
    const clinicGstin = clinic?.gstin || ''
    const clinicWebsite = clinic?.website || ''

    const balanceDue = invoice.grandTotal - invoice.paidAmount

    // Build HTML
    const html = buildInvoiceHtml({
      clinicName,
      clinicAddress,
      clinicPhone,
      clinicEmail,
      clinicWebsite,
      clinicGstin,
      invoice,
      balanceDue,
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'EXPORT',
      module: 'billing',
      details: {
        invoiceId: id,
        invoiceNumber: invoice.invoiceNumber,
        type: 'pdf-html',
      },
      ...extractRequestInfo(request),
    })

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (error) {
    console.error('[INVOICE_PDF]', error)
    return NextResponse.json(
      { error: 'Failed to generate invoice PDF', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── HTML Builder ────────────────────────────────────────────────────────
function buildInvoiceHtml(data: {
  clinicName: string
  clinicAddress: string
  clinicPhone: string
  clinicEmail: string
  clinicWebsite: string
  clinicGstin: string
  invoice: {
    invoiceNumber: string
    date: string
    dueDate: string | null
    status: string
    subtotal: number
    cgst: number
    sgst: number
    igst: number
    totalGst: number
    grandTotal: number
    discount: number
    discountType: string
    roundOff: number
    paidAmount: number
    notes: string | null
    patient: {
      name: string
      patientId: string
      phone: string
      email: string | null
      address: string | null
      city: string | null
      state: string | null
      pincode: string | null
    }
    items: Array<{
      description: string
      hsnCode: string | null
      quantity: number
      unitPrice: number
      gstRate: number
      gstAmount: number
      total: number
      type: string
    }>
    payments: Array<{
      paymentId: string
      amount: number
      method: string
      receiptNumber: string | null
      createdAt: Date
    }>
  }
  balanceDue: number
}): string {
  const inv = data.invoice
  const patientAddress = [inv.patient.address, inv.patient.city, inv.patient.state, inv.patient.pincode].filter(Boolean).join(', ')

  // Item rows
  const itemRows = inv.items.map((item, idx) => `
      <tr>
        <td style="padding:10px 12px;text-align:center;color:#6b7280;border-bottom:1px solid #e5e7eb;font-size:13px;">${idx + 1}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">
          <div style="font-weight:600;font-size:14px;color:#1a1a1a;">${escapeHtml(item.description)}</div>
          <div style="font-size:11px;color:#9ca3af;margin-top:2px;">${escapeHtml(item.type)}</div>
        </td>
        <td style="padding:10px 12px;text-align:center;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:13px;color:#4b5563;">${escapeHtml(item.hsnCode || '—')}</td>
        <td style="padding:10px 12px;text-align:center;border-bottom:1px solid #e5e7eb;font-size:13px;color:#1a1a1a;">${item.quantity}</td>
        <td style="padding:10px 12px;text-align:right;border-bottom:1px solid #e5e7eb;font-size:13px;color:#1a1a1a;">${inr(item.unitPrice)}</td>
        <td style="padding:10px 12px;text-align:center;border-bottom:1px solid #e5e7eb;font-size:13px;color:#1a1a1a;">${item.gstRate}%</td>
        <td style="padding:10px 12px;text-align:right;border-bottom:1px solid #e5e7eb;font-size:13px;color:#1a1a1a;">${inr(item.gstAmount)}</td>
        <td style="padding:10px 12px;text-align:right;border-bottom:1px solid #e5e7eb;font-weight:600;font-size:14px;color:#1a1a1a;">${inr(item.total)}</td>
      </tr>
  `).join('')

  // Payment history rows
  const paymentRows = inv.payments.length > 0
    ? inv.payments.map((p) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-family:monospace;font-size:12px;">${escapeHtml(p.paymentId)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;">${escapeHtml(p.receiptNumber || '—')}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;">${formatDateTime(p.createdAt.toISOString())}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;">${escapeHtml(p.method)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;font-size:13px;color:#059669;">${inr(p.amount)}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="5" style="padding:16px 12px;text-align:center;color:#9ca3af;font-size:13px;">No payments recorded</td></tr>`

  // GST summary
  const gstSummaryRows: string[] = []
  if (inv.cgst > 0) gstSummaryRows.push(`<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;"><span>CGST</span><span>${inr(inv.cgst)}</span></div>`)
  if (inv.sgst > 0) gstSummaryRows.push(`<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;"><span>SGST</span><span>${inr(inv.sgst)}</span></div>`)
  if (inv.igst > 0) gstSummaryRows.push(`<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;"><span>IGST</span><span>${inr(inv.igst)}</span></div>`)
  const gstSummary = gstSummaryRows.join('') || '<div style="font-size:13px;color:#9ca3af;">No GST applicable</div>'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TAX INVOICE — ${escapeHtml(inv.invoiceNumber)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #1a1a1a;
      background: #f9fafb;
      line-height: 1.6;
    }
    .invoice-page {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      padding: 40px;
      min-height: 100vh;
    }
    @media screen {
      body { padding: 20px; }
      .invoice-page { box-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06); border-radius: 8px; }
      .no-print { display: block !important; }
    }
    @media print {
      body { background: #fff; padding: 0; }
      .invoice-page { box-shadow: none; padding: 20px 40px; max-width: 100%; }
      .no-print { display: none !important; }
      @page { margin: 15mm 15mm 20mm 15mm; size: A4; }
    }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .clinic-name { font-size: 22px; font-weight: 700; color: #059669; margin-bottom: 4px; }
    .clinic-subtitle { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; }
    .clinic-info { margin-top: 8px; font-size: 12px; color: #4b5563; line-height: 1.8; }
    .invoice-title-box { text-align: right; }
    .invoice-title { font-size: 28px; font-weight: 800; color: #1a1a1a; letter-spacing: -0.5px; }
    .status-badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 6px; }
    .status-paid { background: #d1fae5; color: #065f46; }
    .status-unpaid { background: #fef3c7; color: #92400e; }
    .status-partial { background: #fef9c3; color: #854d0e; }
    .status-overdue { background: #fee2e2; color: #991b1b; }
    .status-cancelled { background: #f3f4f6; color: #4b5563; }
    .dates { margin-top: 8px; font-size: 12px; color: #6b7280; line-height: 1.8; text-align: right; }
    .divider { height: 1px; background: #e5e7eb; margin: 20px 0; }
    .patient-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin-bottom: 20px; }
    .patient-box-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 8px; }
    .patient-name { font-size: 16px; font-weight: 600; color: #1a1a1a; }
    .patient-detail { font-size: 12px; color: #6b7280; margin-top: 2px; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f9fafb; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; text-align: left; }
    th:first-child { border-radius: 6px 0 0 0; }
    th:last-child { border-radius: 0 6px 0 0; }
    .totals-section { display: flex; justify-content: flex-end; margin-top: 20px; }
    .totals-box { width: 280px; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; }
    .totals-row { display: flex; justify-content: space-between; padding: 8px 16px; font-size: 13px; }
    .totals-row-border { border-bottom: 1px solid #f3f4f6; }
    .totals-grand { background: #059669; color: white; font-weight: 700; font-size: 15px; padding: 12px 16px; }
    .gst-summary-box { margin-top: 16px; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px 16px; }
    .gst-summary-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 8px; }
    .amount-words { margin-top: 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px 16px; font-size: 13px; color: #065f46; }
    .amount-words-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #059669; margin-bottom: 4px; }
    .payment-section { margin-top: 24px; }
    .payment-table { margin-top: 8px; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; }
    .payment-table th { background: #f9fafb; }
    .notes-section { margin-top: 20px; }
    .notes-content { font-size: 13px; color: #4b5563; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px 16px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; }
    .footer-text { font-size: 11px; color: #9ca3af; }
    .print-bar { position: fixed; top: 0; left: 0; right: 0; background: #1a1a1a; color: white; padding: 12px 20px; display: flex; align-items: center; justify-content: center; gap: 16px; z-index: 100; }
    .print-bar button { background: #059669; color: white; border: none; padding: 8px 20px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .print-bar button:hover { background: #047857; }
    .print-bar span { font-size: 13px; }
  </style>
</head>
<body>
  <div class="no-print print-bar">
    <span>Use Ctrl+P / Cmd+P to save as PDF or print</span>
    <button onclick="window.print()">Print / Save PDF</button>
  </div>

  <div class="invoice-page" style="margin-top:60px;">
    <!-- Header -->
    <div class="header">
      <div>
        <div class="clinic-name">${escapeHtml(data.clinicName)}</div>
        <div class="clinic-subtitle">Healthcare Services</div>
        <div class="clinic-info">
          ${data.clinicAddress ? `${escapeHtml(data.clinicAddress)}<br>` : ''}
          ${data.clinicPhone ? `Phone: ${escapeHtml(data.clinicPhone)}<br>` : ''}
          ${data.clinicEmail ? `Email: ${escapeHtml(data.clinicEmail)}<br>` : ''}
          ${data.clinicWebsite ? `Web: ${escapeHtml(data.clinicWebsite)}<br>` : ''}
          ${data.clinicGstin ? `<strong>GSTIN: ${escapeHtml(data.clinicGstin)}</strong>` : ''}
        </div>
      </div>
      <div class="invoice-title-box">
        <div class="invoice-title">TAX INVOICE</div>
        <div class="invoice-title" style="font-size:18px;font-weight:700;color:#6b7280;margin-top:2px;">${escapeHtml(inv.invoiceNumber)}</div>
        <div>
          <span class="status-badge ${getStatusClass(inv.status)}">${escapeHtml(inv.status)}</span>
        </div>
        <div class="dates">
          ${data.clinicGstin ? `<div>GSTIN: ${escapeHtml(data.clinicGstin)}</div>` : ''}
          <div>Issued: ${formatDate(inv.date)}</div>
          ${inv.dueDate ? `<div>Due: ${formatDate(inv.dueDate)}</div>` : ''}
        </div>
      </div>
    </div>

    <div class="divider"></div>

    <!-- Patient Info -->
    <div class="patient-box">
      <div class="patient-box-label">Bill To</div>
      <div class="patient-name">${escapeHtml(inv.patient.name)}</div>
      <div class="patient-detail">Patient ID: ${escapeHtml(inv.patient.patientId)}</div>
      ${inv.patient.phone ? `<div class="patient-detail">Phone: ${escapeHtml(inv.patient.phone)}</div>` : ''}
      ${inv.patient.email ? `<div class="patient-detail">Email: ${escapeHtml(inv.patient.email)}</div>` : ''}
      ${patientAddress ? `<div class="patient-detail">Address: ${escapeHtml(patientAddress)}</div>` : ''}
    </div>

    <!-- Items Table -->
    <div class="section-title">Invoice Items</div>
    <table>
      <thead>
        <tr>
          <th style="padding:10px 12px;text-align:center;width:40px;">#</th>
          <th style="padding:10px 12px;">Description</th>
          <th style="padding:10px 12px;text-align:center;width:80px;">HSN/SAC</th>
          <th style="padding:10px 12px;text-align:center;width:50px;">Qty</th>
          <th style="padding:10px 12px;text-align:right;width:100px;">Unit Price</th>
          <th style="padding:10px 12px;text-align:center;width:60px;">GST%</th>
          <th style="padding:10px 12px;text-align:right;width:100px;">GST Amt</th>
          <th style="padding:10px 12px;text-align:right;width:100px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="totals-section">
      <div class="totals-box">
        <div class="totals-row totals-row-border">
          <span style="color:#6b7280;">Subtotal</span>
          <span>${inr(inv.subtotal)}</span>
        </div>
        <div class="totals-row totals-row-border">
          <span style="color:#6b7280;">Total GST</span>
          <span>${inr(inv.totalGst)}</span>
        </div>
        ${inv.discount > 0 ? `<div class="totals-row totals-row-border">
          <span style="color:#6b7280;">Discount${inv.discountType === 'percentage' ? ' (%)' : ''}</span>
          <span style="color:#dc2626;">- ${inr(inv.discount)}</span>
        </div>` : ''}
        ${inv.roundOff !== 0 ? `<div class="totals-row totals-row-border">
          <span style="color:#6b7280;">Round Off</span>
          <span>${inv.roundOff > 0 ? '+' : ''}${inr(inv.roundOff)}</span>
        </div>` : ''}
        <div class="totals-row totals-grand">
          <span>Grand Total</span>
          <span>${inr(inv.grandTotal)}</span>
        </div>
        <div class="totals-row totals-row-border" style="background:#f0fdf4;">
          <span style="color:#059669;font-weight:600;">Paid</span>
          <span style="color:#059669;font-weight:600;">${inr(inv.paidAmount)}</span>
        </div>
        <div class="totals-row" style="background:#fef2f2;">
          <span style="color:#dc2626;font-weight:600;">Balance Due</span>
          <span style="color:#dc2626;font-weight:700;">${inr(data.balanceDue)}</span>
        </div>
      </div>
    </div>

    <!-- GST Summary -->
    ${inv.totalGst > 0 ? `
    <div class="gst-summary-box">
      <div class="gst-summary-title">GST Breakup</div>
      ${gstSummary}
    </div>` : ''}

    <!-- Amount in Words -->
    <div class="amount-words">
      <div class="amount-words-label">Amount in Words</div>
      <div style="font-weight:600;">${amountToWords(inv.grandTotal)}</div>
    </div>

    ${inv.notes ? `
    <!-- Notes -->
    <div class="notes-section">
      <div class="section-title">Notes</div>
      <div class="notes-content">${escapeHtml(inv.notes)}</div>
    </div>` : ''}

    <!-- Payment History -->
    <div class="payment-section">
      <div class="section-title">Payment History</div>
      <div class="payment-table">
        <table>
          <thead>
            <tr>
              <th style="padding:8px 12px;font-size:10px;">Payment ID</th>
              <th style="padding:8px 12px;font-size:10px;">Receipt No</th>
              <th style="padding:8px 12px;font-size:10px;">Date</th>
              <th style="padding:8px 12px;font-size:10px;">Method</th>
              <th style="padding:8px 12px;font-size:10px;text-align:right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${paymentRows}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-text">This is a computer-generated invoice and does not require a physical signature.</div>
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

function getStatusClass(status: string): string {
  switch (status) {
    case 'Paid': return 'status-paid'
    case 'Unpaid': return 'status-unpaid'
    case 'Partially Paid': return 'status-partial'
    case 'Overdue': return 'status-overdue'
    case 'Cancelled': return 'status-cancelled'
    default: return 'status-unpaid'
  }
}