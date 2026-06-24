import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/reports')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    // Validate date range
    if (fromDate && !/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
      return NextResponse.json({ error: 'Invalid fromDate format', details: 'Must be YYYY-MM-DD' }, { status: 400 })
    }
    if (toDate && !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      return NextResponse.json({ error: 'Invalid toDate format', details: 'Must be YYYY-MM-DD' }, { status: 400 })
    }

    const dateFilter: Record<string, unknown> | null = fromDate || toDate
      ? {
          createdAt: {
            ...(fromDate ? { gte: new Date(fromDate) } : {}),
            ...(toDate ? { lte: new Date(toDate + 'T23:59:59.999Z') } : {}),
          },
        }
      : null

    // Fetch all non-cancelled invoices with items in the date range
    const invoices = await db.invoice.findMany({
      where: {
        ...(dateFilter || {}),
        status: { not: 'Cancelled' },
      },
      include: {
        items: true,
        patient: {
          select: { name: true, state: true },
        },
      },
      orderBy: { date: 'desc' },
    })

    // ── GSTR-1: Invoice-level data with HSN-wise summary ────────────────
    const gstr1Invoices = invoices.map((inv) => {
      const items = inv.items.map((item) => ({
        hsnCode: item.hsnCode || '0000',
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxableValue: parseFloat((item.unitPrice * item.quantity).toFixed(2)),
        gstRate: item.gstRate,
        gstAmount: item.gstAmount,
        cgst: parseFloat((item.gstAmount / 2).toFixed(2)),
        sgst: parseFloat((item.gstAmount / 2).toFixed(2)),
        igst: 0,
        total: parseFloat(((item.unitPrice * item.quantity) + item.gstAmount).toFixed(2)),
        type: item.type,
      }))

      const totalCgst = items.reduce((sum, i) => sum + i.cgst, 0)
      const totalSgst = items.reduce((sum, i) => sum + i.sgst, 0)
      const totalTax = totalCgst + totalSgst

      return {
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.date,
        patientName: inv.patient.name,
        patientGstin: null,
        placeOfSupply: inv.patient.state || '',
        invoiceValue: inv.grandTotal,
        items,
        totalCgst: parseFloat(totalCgst.toFixed(2)),
        totalSgst: parseFloat(totalSgst.toFixed(2)),
        totalIgst: 0,
        totalTax: parseFloat(totalTax.toFixed(2)),
        taxableValue: inv.subtotal,
        status: inv.status,
      }
    })

    // HSN-wise summary for GSTR-1
    const hsnMap: Record<string, {
      hsnCode: string
      description: string
      totalQuantity: number
      totalValue: number
      cgst: number
      sgst: number
      igst: number
      totalTax: number
    }> = {}

    for (const inv of invoices) {
      for (const item of inv.items) {
        const hsn = item.hsnCode || '0000'
        if (!hsnMap[hsn]) {
          hsnMap[hsn] = {
            hsnCode: hsn,
            description: item.description,
            totalQuantity: 0,
            totalValue: 0,
            cgst: 0,
            sgst: 0,
            igst: 0,
            totalTax: 0,
          }
        }
        const lineValue = item.unitPrice * item.quantity
        hsnMap[hsn].totalQuantity += item.quantity
        hsnMap[hsn].totalValue += lineValue
        hsnMap[hsn].cgst += item.gstAmount / 2
        hsnMap[hsn].sgst += item.gstAmount / 2
        hsnMap[hsn].totalTax += item.gstAmount
      }
    }

    const hsnSummary = Object.values(hsnMap)
      .map((h) => ({
        hsnCode: h.hsnCode,
        description: h.description,
        totalQuantity: h.totalQuantity,
        totalValue: parseFloat(h.totalValue.toFixed(2)),
        cgst: parseFloat(h.cgst.toFixed(2)),
        sgst: parseFloat(h.sgst.toFixed(2)),
        igst: parseFloat(h.igst.toFixed(2)),
        totalTax: parseFloat(h.totalTax.toFixed(2)),
      }))
      .sort((a, b) => a.hsnCode.localeCompare(b.hsnCode))

    // ── GSTR-3B: Summary for return filing ─────────────────────────────
    const totalOutwardSupplies = invoices.reduce((sum, inv) => sum + inv.subtotal, 0)
    const totalCgst3b = invoices.reduce((sum, inv) => sum + inv.cgst, 0)
    const totalSgst3b = invoices.reduce((sum, inv) => sum + inv.sgst, 0)
    const totalIgst3b = invoices.reduce((sum, inv) => sum + inv.igst, 0)
    const totalTax3b = totalCgst3b + totalSgst3b + totalIgst3b

    // Tax breakdown by rate
    const taxByRate: Record<number, { taxableValue: number; cgst: number; sgst: number; igst: number; totalTax: number; invoiceCount: number }> = {}
    for (const inv of invoices) {
      for (const item of inv.items) {
        const rate = item.gstRate
        if (!taxByRate[rate]) {
          taxByRate[rate] = { taxableValue: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0, invoiceCount: 0 }
        }
        const lineValue = item.unitPrice * item.quantity
        taxByRate[rate].taxableValue += lineValue
        taxByRate[rate].cgst += item.gstAmount / 2
        taxByRate[rate].sgst += item.gstAmount / 2
        taxByRate[rate].totalTax += item.gstAmount
      }
    }

    const gstr3b = {
      outwardSupplies: parseFloat(totalOutwardSupplies.toFixed(2)),
      igst: parseFloat(totalIgst3b.toFixed(2)),
      cgst: parseFloat(totalCgst3b.toFixed(2)),
      sgst: parseFloat(totalSgst3b.toFixed(2)),
      totalTax: parseFloat(totalTax3b.toFixed(2)),
      taxableValue: parseFloat(totalOutwardSupplies.toFixed(2)),
      taxByRate: Object.entries(taxByRate).map(([rate, data]) => ({
        rate: parseFloat(rate),
        ...data,
        taxableValue: parseFloat(data.taxableValue.toFixed(2)),
        cgst: parseFloat(data.cgst.toFixed(2)),
        sgst: parseFloat(data.sgst.toFixed(2)),
        igst: parseFloat(data.igst.toFixed(2)),
        totalTax: parseFloat(data.totalTax.toFixed(2)),
      })).sort((a, b) => a.rate - b.rate),
      totalInvoices: invoices.length,
      invoiceDateRange: {
        from: invoices.length > 0 ? invoices[invoices.length - 1].date : null,
        to: invoices.length > 0 ? invoices[0].date : null,
      },
    }

    return NextResponse.json({
      data: {
        gstr1: gstr1Invoices,
        gstr3b,
        hsnSummary,
        period: {
          fromDate: fromDate || null,
          toDate: toDate || null,
        },
      },
    })
  } catch (error) {
    console.error('[GST_REPORT_GET]', error)
    return NextResponse.json(
      { error: 'Failed to generate GST report', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}