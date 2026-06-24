import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest, getTenantFilter } from '@/lib/api-auth'

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/reports')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { searchParams } = request.nextUrl
    const type = searchParams.get('type')?.trim() || 'financial'
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    // Validate date range
    if (fromDate && !/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
      return NextResponse.json({ error: 'Invalid fromDate format', details: 'Must be YYYY-MM-DD' }, { status: 400 })
    }
    if (toDate && !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      return NextResponse.json({ error: 'Invalid toDate format', details: 'Must be YYYY-MM-DD' }, { status: 400 })
    }

    const dateFilter: Record<string, unknown> = {}
    if (fromDate) dateFilter.gte = new Date(fromDate)
    if (toDate) dateFilter.lte = new Date(toDate + 'T23:59:59.999Z')

    const tenantFilter = getTenantFilter(auth.role, auth.branchId, request)

    switch (type) {
      case 'financial':
        return await getFinancialReport(dateFilter, tenantFilter)
      case 'patients':
        return await getPatientsReport(dateFilter, tenantFilter)
      case 'gst':
        return await getGSTReport(dateFilter, tenantFilter)
      case 'appointments':
        return await getAppointmentReport(dateFilter, tenantFilter)
      case 'revenue':
        return await getRevenueAnalytics(tenantFilter)
      case 'revenue-prev':
        return await getRevenuePreviousPeriod(tenantFilter)
      case 'patient-flow':
        return await getPatientFlowAnalytics(tenantFilter)
      case 'billing':
        return await getBillingAnalytics(tenantFilter)
      case 'doctor-performance':
        return await getDoctorPerformanceAnalytics(tenantFilter)
      default:
        return NextResponse.json(
          { error: 'Invalid report type', details: 'Must be one of: financial, patients, gst, appointments, revenue, revenue-prev, patient-flow, billing, doctor-performance' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('[REPORTS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to generate report', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── Financial Report ─────────────────────────────────────────────────────
async function getFinancialReport(dateFilter: Record<string, unknown>, tenantFilter: Record<string, unknown>) {
  const baseWhere = dateFilter.createdAt ? { ...tenantFilter, createdAt: dateFilter } : tenantFilter

  const [invoices, payments] = await Promise.all([
    db.invoice.findMany({
      where: baseWhere,
      orderBy: { date: 'desc' },
    }),
    db.payment.findMany({
      where: baseWhere,
    }),
  ])

  const totalRevenue = invoices
    .filter((i) => i.status !== 'Cancelled')
    .reduce((sum, i) => sum + i.grandTotal, 0)

  const totalCollected = payments
    .filter((p) => p.status === 'Success')
    .reduce((sum, p) => sum + p.amount, 0)

  const totalOutstanding = invoices
    .filter((i) => i.status === 'Unpaid' || i.status === 'Partially Paid')
    .reduce((sum, i) => sum + (i.grandTotal - i.paidAmount), 0)

  const totalRefunded = payments
    .filter((p) => p.status === 'Refunded')
    .reduce((sum, p) => sum + p.amount, 0)

  const totalDiscount = invoices
    .filter((i) => i.status !== 'Cancelled')
    .reduce((sum, i) => sum + i.discount, 0)

  // Revenue by payment method
  const revenueByMethod = payments
    .filter((p) => p.status === 'Success')
    .reduce<Record<string, number>>((acc, p) => {
      acc[p.method] = (acc[p.method] || 0) + p.amount
      return acc
    }, {})

  // Invoices by status
  const invoicesByStatus = invoices.reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] || 0) + 1
    return acc
  }, {})

  return NextResponse.json({
    data: {
      type: 'financial',
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalCollected: parseFloat(totalCollected.toFixed(2)),
      totalOutstanding: parseFloat(totalOutstanding.toFixed(2)),
      totalRefunded: parseFloat(totalRefunded.toFixed(2)),
      totalDiscount: parseFloat(totalDiscount.toFixed(2)),
      totalGST: parseFloat(
        invoices.filter((i) => i.status !== 'Cancelled').reduce((sum, i) => sum + i.totalGst, 0).toFixed(2)
      ),
      revenueByMethod,
      invoicesByStatus,
      totalInvoices: invoices.length,
      totalPayments: payments.length,
    },
  })
}

// ── Patients Report ──────────────────────────────────────────────────────
async function getPatientsReport(dateFilter: Record<string, unknown>, tenantFilter: Record<string, unknown>) {
  const dateWhere = dateFilter.createdAt ? { ...tenantFilter, createdAt: dateFilter } : tenantFilter

  const [totalPatients, activePatients, recentPatients, patientsByGender] = await Promise.all([
    db.patient.count({ where: tenantFilter }),
    db.patient.count({ where: { ...tenantFilter, status: 'Active' } }),
    db.patient.findMany({
      where: dateWhere,
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, patientId: true, name: true, phone: true, createdAt: true, status: true },
    }),
    db.patient.groupBy({
      by: ['gender'],
      where: tenantFilter,
      _count: { id: true },
    }),
  ])

  const genderDistribution = patientsByGender.reduce<Record<string, number>>((acc, g) => {
    acc[g.gender || 'Unknown'] = g._count.id
    return acc
  }, {})

  return NextResponse.json({
    data: {
      type: 'patients',
      totalPatients,
      activePatients,
      inactivePatients: totalPatients - activePatients,
      genderDistribution,
      recentPatients,
    },
  })
}

// ── GST Report ───────────────────────────────────────────────────────────
async function getGSTReport(dateFilter: Record<string, unknown>, tenantFilter: Record<string, unknown>) {
  const whereClause = dateFilter.createdAt
    ? { ...tenantFilter, createdAt: dateFilter }
    : { ...tenantFilter, status: { not: 'Cancelled' } }

  const invoices = await db.invoice.findMany({
    where: whereClause,
    include: { items: true },
  })

  const totalCGST = invoices.reduce((sum, i) => sum + i.cgst, 0)
  const totalSGST = invoices.reduce((sum, i) => sum + i.sgst, 0)
  const totalIGST = invoices.reduce((sum, i) => sum + i.igst, 0)
  const totalGST = invoices.reduce((sum, i) => sum + i.totalGst, 0)
  const totalTaxable = invoices.reduce((sum, i) => sum + i.subtotal, 0)

  // GST breakdown by rate
  const gstByRate: Record<number, { taxable: number; gst: number; count: number }> = {}
  for (const inv of invoices) {
    for (const item of inv.items) {
      const rate = item.gstRate
      if (!gstByRate[rate]) gstByRate[rate] = { taxable: 0, gst: 0, count: 0 }
      const lineTotal = item.unitPrice * item.quantity
      gstByRate[rate].taxable += lineTotal
      gstByRate[rate].gst += item.gstAmount
      gstByRate[rate].count++
    }
  }

  return NextResponse.json({
    data: {
      type: 'gst',
      totalCGST: parseFloat(totalCGST.toFixed(2)),
      totalSGST: parseFloat(totalSGST.toFixed(2)),
      totalIGST: parseFloat(totalIGST.toFixed(2)),
      totalGST: parseFloat(totalGST.toFixed(2)),
      totalTaxable: parseFloat(totalTaxable.toFixed(2)),
      gstByRate,
      totalInvoices: invoices.length,
    },
  })
}

// ── Appointments Report ─────────────────────────────────────────────────
async function getAppointmentReport(dateFilter: Record<string, unknown>, tenantFilter: Record<string, unknown>) {
  const whereClause: Record<string, unknown> = { ...tenantFilter }
  if (dateFilter.createdAt) {
    whereClause.createdAt = dateFilter
  }

  const [totalAppointments, byStatus, byType, recentAppointments, topDoctors] = await Promise.all([
    db.appointment.count({ where: whereClause }),
    db.appointment.groupBy({
      by: ['status'],
      where: whereClause,
      _count: { id: true },
    }),
    db.appointment.groupBy({
      by: ['type'],
      where: whereClause,
      _count: { id: true },
    }),
    db.appointment.findMany({
      where: whereClause,
      take: 10,
      orderBy: { date: 'desc' },
      include: {
        patient: { select: { name: true } },
        doctor: { select: { name: true, specialization: true } },
      },
    }),
    db.appointment.groupBy({
      by: ['doctorId'],
      where: { ...whereClause, status: 'Completed' },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    }).then((groups) =>
      Promise.all(
        groups.map(async (g) => {
          const doctor = await db.doctor.findUnique({
            where: { id: g.doctorId },
            select: { name: true, specialization: true },
          })
          return { doctorId: g.doctorId, name: doctor?.name, specialization: doctor?.specialization, count: g._count.id }
        })
      )
    ),
  ])

  const statusBreakdown = byStatus.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = s._count.id
    return acc
  }, {})

  const typeBreakdown = byType.reduce<Record<string, number>>((acc, t) => {
    acc[t.type] = t._count.id
    return acc
  }, {})

  return NextResponse.json({
    data: {
      type: 'appointments',
      totalAppointments,
      statusBreakdown,
      typeBreakdown,
      recentAppointments,
      topDoctors,
    },
  })
}

// ── Revenue Analytics ─────────────────────────────────────────────────────
async function getRevenueAnalytics(tenantFilter: Record<string, unknown>) {
  const now = new Date()

  // Daily revenue for last 30 days
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
  thirtyDaysAgo.setHours(0, 0, 0, 0)

  const recentPayments = await db.payment.findMany({
    where: {
      ...tenantFilter,
      status: 'Success',
      createdAt: { gte: thirtyDaysAgo },
    },
    select: { amount: true, createdAt: true, method: true },
  })

  // Build daily revenue map
  const dailyRevenueMap: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    dailyRevenueMap[key] = 0
  }
  for (const p of recentPayments) {
    const key = p.createdAt.toISOString().split('T')[0]
    if (dailyRevenueMap[key] !== undefined) {
      dailyRevenueMap[key] += p.amount
    }
  }
  const dailyRevenue = Object.entries(dailyRevenueMap).map(([date, amount]) => ({
    date,
    amount: parseFloat(amount.toFixed(2)),
  }))

  // Revenue by payment method
  const revenueByMethod: Record<string, number> = {}
  for (const p of recentPayments) {
    revenueByMethod[p.method] = (revenueByMethod[p.method] || 0) + p.amount
  }
  const revenueByMethodFormatted: Record<string, number> = {}
  for (const [k, v] of Object.entries(revenueByMethod)) {
    revenueByMethodFormatted[k] = parseFloat(v.toFixed(2))
  }

  // Revenue by department (from visits)
  const visitsWithInvoices = await db.patientVisit.findMany({
    where: { ...tenantFilter, status: { not: 'Cancelled' } },
    select: { department: true },
  })
  const departmentMap: Record<string, number> = {}
  for (const v of visitsWithInvoices) {
    const dept = v.department || 'Unassigned'
    departmentMap[dept] = (departmentMap[dept] || 0) + 1
  }
  const revenueByDepartment = Object.entries(departmentMap).map(([department, visits]) => ({
    department,
    visits,
  }))

  // Monthly revenue trend (6 months)
  const monthlyRevenue = await Promise.all(
    (() => {
      const months: string[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        months.push(d.toISOString().slice(0, 7))
      }
      return months.map(async (month) => {
        const startDate = new Date(`${month}-01T00:00:00.000Z`)
        const endDate = new Date(startDate)
        endDate.setMonth(endDate.getMonth() + 1)

        const result = await db.payment.aggregate({
          where: { ...tenantFilter, status: 'Success', createdAt: { gte: startDate, lt: endDate } },
          _sum: { amount: true },
        })

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        const monthDate = new Date(`${month}-01`)
        return {
          month,
          label: `${monthNames[monthDate.getMonth()]} ${monthDate.getFullYear()}`,
          revenue: parseFloat((result._sum.amount ?? 0).toFixed(2)),
        }
      })
    })()
  )

  // Total metrics
  const totalRevenue = recentPayments.reduce((sum, p) => sum + p.amount, 0)
  const allInvoices = await db.invoice.findMany({
    where: { ...tenantFilter, status: { in: ['Unpaid', 'Partially Paid'] } },
    select: { grandTotal: true, paidAmount: true },
  })
  const totalOutstanding = allInvoices.reduce((sum, inv) => sum + (inv.grandTotal - inv.paidAmount), 0)
  const avgInvoiceResult = await db.invoice.aggregate({ where: tenantFilter, _avg: { grandTotal: true } })
  const avgInvoice = avgInvoiceResult._avg.grandTotal ?? 0

  return NextResponse.json({
    data: {
      type: 'revenue',
      dailyRevenue,
      revenueByMethod: revenueByMethodFormatted,
      revenueByDepartment,
      monthlyRevenue,
      totalRevenue30Days: parseFloat(totalRevenue.toFixed(2)),
      totalOutstanding: parseFloat(totalOutstanding.toFixed(2)),
      averageInvoice: parseFloat(avgInvoice.toFixed(2)),
    },
  })
}

// ── Revenue Previous Period ─────────────────────────────────────────────
async function getRevenuePreviousPeriod(tenantFilter: Record<string, unknown>) {
  const now = new Date()
  const prevStart = new Date(now)
  prevStart.setDate(prevStart.getDate() - 59)
  prevStart.setHours(0, 0, 0, 0)
  const prevEnd = new Date(now)
  prevEnd.setDate(prevEnd.getDate() - 30)
  prevEnd.setHours(23, 59, 59, 999)

  const prevPayments = await db.payment.findMany({
    where: { ...tenantFilter, status: 'Success', createdAt: { gte: prevStart, lte: prevEnd } },
    select: { amount: true },
  })
  const prevRevenue = prevPayments.reduce((sum, p) => sum + p.amount, 0)

  const prevInvoices = await db.invoice.findMany({
    where: { ...tenantFilter, createdAt: { gte: prevStart, lte: prevEnd } },
    select: { grandTotal: true },
  })
  const prevAvg = prevInvoices.length > 0
    ? prevInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0) / prevInvoices.length
    : 0

  return NextResponse.json({
    data: {
      type: 'revenue-prev',
      totalRevenue30Days: parseFloat(prevRevenue.toFixed(2)),
      averageInvoice: parseFloat(prevAvg.toFixed(2)),
    },
  })
}

// ── Patient Flow Analytics ──────────────────────────────────────────────
async function getPatientFlowAnalytics(tenantFilter: Record<string, unknown>) {
  const [allVisits, visitsByStageRaw, visitTypeCounts, doctors] = await Promise.all([
    // All visits
    db.patientVisit.findMany({
      where: tenantFilter,
      select: { id: true, stage: true, status: true, visitType: true, department: true, createdAt: true, doctorId: true },
    }),
    // Visits grouped by stage (active)
    db.patientVisit.groupBy({
      by: ['stage'],
      where: { ...tenantFilter, status: 'Active' },
      _count: { stage: true },
      orderBy: { _count: { stage: 'desc' } },
    }),
    // Visit type counts (OPD vs IPD etc.)
    db.patientVisit.groupBy({
      by: ['visitType'],
      where: tenantFilter,
      _count: { visitType: true },
    }),
    // Doctors for department mapping
    db.doctor.findMany({ select: { id: true, name: true, specialization: true } }),
  ])

  // Stage distribution (patients currently at each stage)
  const stageOrder = ['Registration', 'Triage', 'Waiting', 'In-Consultation', 'Lab-Ordered', 'Lab-Done', 'Prescribed', 'Billed', 'Paid', 'Discharged']
  const stageDistribution = stageOrder
    .map((stage) => {
      const found = visitsByStageRaw.find((g) => g.stage === stage)
      return { stage, count: found ? found._count.stage : 0 }
    })
    .filter((s) => s.count > 0)

  // Visits by department
  const deptMap: Record<string, number> = {}
  for (const v of allVisits) {
    const dept = v.department || 'Unassigned'
    deptMap[dept] = (deptMap[dept] || 0) + 1
  }
  const visitsByDepartment = Object.entries(deptMap)
    .map(([department, visits]) => ({ department, visits }))
    .sort((a, b) => b.visits - a.visits)

  // OPD vs IPD distribution
  const opdVsIpd = {
    OPD: visitTypeCounts.find((g) => g.visitType === 'OPD')?._count.visitType ?? 0,
    IPD: visitTypeCounts.find((g) => g.visitType === 'IPD')?._count.visitType ?? 0,
    Emergency: visitTypeCounts.find((g) => g.visitType === 'Emergency')?._count.visitType ?? 0,
    'Follow-up': visitTypeCounts.find((g) => g.visitType === 'Follow-up')?._count.visitType ?? 0,
  }

  // Peak hours analysis (by hour of day)
  const hourMap: Record<number, number> = {}
  for (let h = 0; h < 24; h++) hourMap[h] = 0
  for (const v of allVisits) {
    const hour = v.createdAt.getHours()
    hourMap[hour] = (hourMap[hour] || 0) + 1
  }
  const peakHours = Object.entries(hourMap)
    .map(([hour, count]) => ({
      hour: parseInt(hour),
      count,
      label: `${hour.toString().padStart(2, '0')}:00`,
    }))
    .filter((h) => h.count > 0)

  // Average visit duration by stage (based on VisitStage timestamps)
  // Get visit IDs for tenant to scope the visit stage query
  const tenantVisitIds = allVisits.map(v => v.id)
  const visitStages = tenantVisitIds.length > 0
    ? await db.visitStage.findMany({
        where: { visitId: { in: tenantVisitIds }, status: 'Completed', completedAt: { not: null } },
        select: { stage: true, createdAt: true, completedAt: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      })
    : []

  const stageDurationMap: Record<string, { total: number; count: number }> = {}
  for (const vs of visitStages) {
    if (!vs.completedAt) continue
    const durationMs = vs.completedAt.getTime() - vs.createdAt.getTime()
    const durationMin = durationMs / 60000
    if (!stageDurationMap[vs.stage]) stageDurationMap[vs.stage] = { total: 0, count: 0 }
    stageDurationMap[vs.stage].total += durationMin
    stageDurationMap[vs.stage].count++
  }
  const averageDurationByStage = Object.entries(stageDurationMap)
    .map(([stage, data]) => ({
      stage,
      averageMinutes: parseFloat((data.total / data.count).toFixed(1)),
      visits: data.count,
    }))
    .sort((a, b) => b.visits - a.visits)

  // Total counts
  const totalVisits = allVisits.length
  const activeVisits = allVisits.filter((v) => v.status === 'Active').length
  const completedVisits = allVisits.filter((v) => v.status === 'Completed').length

  return NextResponse.json({
    data: {
      type: 'patient-flow',
      stageDistribution,
      visitsByDepartment,
      opdVsIpd,
      peakHours,
      averageDurationByStage,
      totalVisits,
      activeVisits,
      completedVisits,
    },
  })
}

// ── Billing Analytics ────────────────────────────────────────────────────
async function getBillingAnalytics(tenantFilter: Record<string, unknown>) {
  const now = new Date()
  const today = now.toISOString().split('T')[0]

  const [allInvoices, payments] = await Promise.all([
    db.invoice.findMany({
      where: tenantFilter,
      include: {
        patient: { select: { name: true, patientId: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.payment.findMany({
      where: tenantFilter,
    }),
  ])

  // Outstanding invoices
  const outstandingInvoices = allInvoices
    .filter((i) => i.status === 'Unpaid' || i.status === 'Partially Paid')
    .map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      patientName: i.patient.name,
      patientId: i.patient.patientId,
      date: i.date,
      dueDate: i.dueDate || null,
      grandTotal: i.grandTotal,
      paidAmount: i.paidAmount,
      balance: parseFloat((i.grandTotal - i.paidAmount).toFixed(2)),
      status: i.status,
    }))

  // Overdue invoices (past due date and unpaid/partially paid)
  const overdueInvoices = outstandingInvoices.filter(
    (i) => i.dueDate && i.dueDate < today && i.status !== 'Paid'
  ).map((i) => {
    const dueDate = new Date(i.dueDate!)
    const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    return { ...i, daysOverdue }
  }).sort((a, b) => b.daysOverdue - a.daysOverdue)

  // Aging buckets for overdue
  const agingBuckets = [
    { label: '1-30 days', min: 1, max: 30, count: 0, total: 0 },
    { label: '31-60 days', min: 31, max: 60, count: 0, total: 0 },
    { label: '61-90 days', min: 61, max: 90, count: 0, total: 0 },
    { label: '90+ days', min: 91, max: Infinity, count: 0, total: 0 },
  ]
  for (const inv of overdueInvoices) {
    for (const bucket of agingBuckets) {
      if (inv.daysOverdue >= bucket.min && inv.daysOverdue <= bucket.max) {
        bucket.count++
        bucket.total += inv.balance
        break
      }
    }
  }

  // Average invoice amount
  const nonCancelled = allInvoices.filter((i) => i.status !== 'Cancelled')
  const avgInvoiceAmount = nonCancelled.length > 0
    ? nonCancelled.reduce((sum, i) => sum + i.grandTotal, 0) / nonCancelled.length
    : 0

  // Discount analysis
  const totalDiscount = nonCancelled.reduce((sum, i) => sum + i.discount, 0)
  const invoicesWithDiscount = nonCancelled.filter((i) => i.discount > 0)
  const avgDiscount = invoicesWithDiscount.length > 0
    ? invoicesWithDiscount.reduce((sum, i) => sum + i.discount, 0) / invoicesWithDiscount.length
    : 0

  // Collection rate
  const totalRevenue = nonCancelled.reduce((sum, i) => sum + i.grandTotal, 0)
  const totalCollected = payments.filter((p) => p.status === 'Success').reduce((sum, p) => sum + p.amount, 0)
  const collectionRate = totalRevenue > 0 ? (totalCollected / totalRevenue) * 100 : 0

  // Invoice count by status
  const invoiceStatusCounts: Record<string, number> = {}
  for (const i of allInvoices) {
    invoiceStatusCounts[i.status] = (invoiceStatusCounts[i.status] || 0) + 1
  }

  return NextResponse.json({
    data: {
      type: 'billing',
      outstandingInvoices,
      outstandingCount: outstandingInvoices.length,
      outstandingTotal: parseFloat(outstandingInvoices.reduce((sum, i) => sum + i.balance, 0).toFixed(2)),
      overdueInvoices,
      overdueCount: overdueInvoices.length,
      overdueTotal: parseFloat(overdueInvoices.reduce((sum, i) => sum + i.balance, 0).toFixed(2)),
      agingBuckets: agingBuckets.map((b) => ({ ...b, total: parseFloat(b.total.toFixed(2)) })),
      averageInvoiceAmount: parseFloat(avgInvoiceAmount.toFixed(2)),
      totalDiscount: parseFloat(totalDiscount.toFixed(2)),
      invoicesWithDiscountCount: invoicesWithDiscount.length,
      averageDiscount: parseFloat(avgDiscount.toFixed(2)),
      collectionRate: parseFloat(collectionRate.toFixed(1)),
      invoiceStatusCounts,
      totalInvoices: allInvoices.length,
    },
  })
}

// ── Doctor Performance Analytics ────────────────────────────────────────
async function getDoctorPerformanceAnalytics(tenantFilter: Record<string, unknown>) {
  const [doctors, appointments, visits, prescriptions] = await Promise.all([
    db.doctor.findMany({
      where: { status: 'Active' },
      select: { id: true, doctorId: true, name: true, specialization: true, consultationFee: true, experience: true },
    }),
    db.appointment.findMany({
      where: { ...tenantFilter, status: 'Completed' },
      select: { doctorId: true, patientId: true, date: true, type: true },
    }),
    db.patientVisit.findMany({
      where: tenantFilter,
      select: { doctorId: true, department: true, createdAt: true },
    }),
    db.prescription.findMany({
      select: { doctorId: true },
    }),
  ])

  // Build doctor performance data
  const doctorMap: Record<string, {
    id: string
    doctorId: string
    name: string
    specialization: string
    consultationFee: number
    experience: number
    patientsSeen: number
    visitsCount: number
    prescriptionsCount: number
  }> = {}

  for (const doc of doctors) {
    doctorMap[doc.id] = {
      id: doc.id,
      doctorId: doc.doctorId,
      name: doc.name,
      specialization: doc.specialization,
      consultationFee: doc.consultationFee,
      experience: doc.experience,
      patientsSeen: 0,
      visitsCount: 0,
      prescriptionsCount: 0,
    }
  }

  // Count completed appointments per doctor
  for (const apt of appointments) {
    if (doctorMap[apt.doctorId]) {
      doctorMap[apt.doctorId].patientsSeen++
    }
  }

  // Count visits per doctor
  for (const v of visits) {
    if (v.doctorId && doctorMap[v.doctorId]) {
      doctorMap[v.doctorId].visitsCount++
    }
  }

  // Count prescriptions per doctor
  for (const rx of prescriptions) {
    if (doctorMap[rx.doctorId]) {
      doctorMap[rx.doctorId].prescriptionsCount++
    }
  }

  // Revenue per doctor (from their appointments × consultation fee)
  const doctorPerformance = Object.values(doctorMap).map((doc) => ({
    ...doc,
    revenueGenerated: parseFloat((doc.patientsSeen * doc.consultationFee).toFixed(2)),
    avgPatientsPerDay: doc.patientsSeen > 0 ? parseFloat((doc.patientsSeen / 30).toFixed(1)) : 0,
  })).sort((a, b) => b.revenueGenerated - a.revenueGenerated)

  // Summary stats
  const totalDoctors = doctorPerformance.length
  const totalPatientsSeen = doctorPerformance.reduce((sum, d) => sum + d.patientsSeen, 0)
  const totalRevenue = doctorPerformance.reduce((sum, d) => sum + d.revenueGenerated, 0)

  return NextResponse.json({
    data: {
      type: 'doctor-performance',
      doctors: doctorPerformance,
      totalDoctors,
      totalPatientsSeen,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    },
  })
}