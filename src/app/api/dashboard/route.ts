import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest, getTenantFilter } from '@/lib/api-auth'

// ── GET (parallelized dashboard) ─────────────────────────────────────────
export async function GET(request: Request) {
  const auth = await authenticateRequest(request, '/api/dashboard')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const today = new Date().toISOString().split('T')[0]
    const tenantFilter = getTenantFilter(auth.role, auth.branchId, request)

    // Parallel queries for maximum performance
    // Visits by current stage (grouped)
    const visitsByStageRaw = await db.patientVisit.groupBy({
      by: ['stage'],
      where: { ...tenantFilter, status: 'Active' },
      _count: { stage: true },
      orderBy: { _count: { stage: 'desc' } },
    })

    const [
      totalPatients,
      todayAppointments,
      todayPaymentsResult,
      recentAppointments,
      recentPayments,
      appointmentsByStatus,
      // ── Workflow metrics ──
      activeVisits,
      todayRegistrations,
      todaysDischarges,
      opdCount,
      ipdCount,
    ] = await Promise.all([
      // Total active patients
      db.patient.count({ where: { ...tenantFilter, status: 'Active' } }),

      // Today's appointments
      db.appointment.count({ where: { ...tenantFilter, date: today } }),

      // Today's revenue (successful payments today)
      db.payment.aggregate({
        where: {
          ...tenantFilter,
          status: 'Success',
          createdAt: { gte: new Date(today), lt: new Date(today + 'T23:59:59.999Z') },
        },
        _sum: { amount: true },
      }),

      // Outstanding payments (Unpaid + Partially Paid invoices)
      db.invoice.aggregate({
        where: { ...tenantFilter, status: { in: ['Unpaid', 'Partially Paid'] } },
        _sum: { grandTotal: true },
        _count: true,
      }),

      // Recent appointments (last 10)
      db.appointment.findMany({
        where: tenantFilter,
        take: 10,
        orderBy: [{ date: 'desc' }, { time: 'desc' }],
        include: {
          patient: { select: { id: true, patientId: true, name: true } },
          doctor: { select: { id: true, doctorId: true, name: true, specialization: true } },
        },
      }),

      // Recent payments (last 5)
      db.payment.findMany({
        where: { ...tenantFilter, status: 'Success' },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: { select: { id: true, patientId: true, name: true } },
          invoice: { select: { id: true, invoiceNumber: true } },
        },
      }),

      // Appointments by status
      Promise.all([
        db.appointment.count({ where: { ...tenantFilter, status: 'Scheduled' } }),
        db.appointment.count({ where: { ...tenantFilter, status: 'Completed' } }),
        db.appointment.count({ where: { ...tenantFilter, status: 'Cancelled' } }),
        db.appointment.count({ where: { ...tenantFilter, status: 'No-Show' } }),
      ]),

      // Monthly revenue placeholder (computed below with proper dates)
      Promise.resolve([]),

      // ── Workflow metrics queries ──
      // Active visits (not completed/cancelled)
      db.patientVisit.count({ where: { ...tenantFilter, status: 'Active' } }),

      // Today's registrations
      db.patientVisit.count({
        where: { ...tenantFilter, createdAt: { gte: new Date(today), lt: new Date(today + 'T23:59:59.999Z') } },
      }),

      // Today's discharges
      db.patientVisit.count({
        where: {
          ...tenantFilter,
          stage: 'Discharged',
          updatedAt: { gte: new Date(today), lt: new Date(today + 'T23:59:59.999Z') },
        },
      }),

      // OPD count
      db.patientVisit.count({ where: { ...tenantFilter, status: 'Active', visitType: 'OPD' } }),

      // IPD count
      db.patientVisit.count({ where: { ...tenantFilter, status: 'Active', visitType: 'IPD' } }),
    ])

    // Calculate outstanding (total minus paid for unpaid/partially paid invoices)
    const outstandingInvoicesDetail = await db.invoice.findMany({
      where: { ...tenantFilter, status: { in: ['Unpaid', 'Partially Paid'] } },
      select: { grandTotal: true, paidAmount: true },
    })
    const totalOutstanding = outstandingInvoicesDetail.reduce(
      (sum, inv) => sum + (inv.grandTotal - inv.paidAmount),
      0
    )

    const [scheduled, completed, cancelled, noShow] = appointmentsByStatus

    // Process visitsByStage
    const visitsByStage = visitsByStageRaw.map((g) => ({
      stage: g.stage,
      count: g._count.stage,
    }))

    // Average consultation time computed from completed visit stage timestamps
    const consultationVisits = await db.patientVisit.findMany({
      where: {
        ...tenantFilter,
        status: 'Completed',
        stages: { some: { stage: 'In-Consultation', status: 'Completed' } },
      },
      select: {
        stages: {
          where: { stage: { in: ['In-Consultation', 'Prescribed'] } },
          select: { stage: true, completedAt: true },
          orderBy: { completedAt: 'asc' },
        },
      },
      take: 50,
    })
    let avgConsultationTime = 0
    if (consultationVisits.length > 0) {
      const durations: number[] = []
      for (const visit of consultationVisits) {
        const start = visit.stages.find(s => s.stage === 'In-Consultation')?.completedAt
        const end = visit.stages.find(s => s.stage === 'Prescribed')?.completedAt
        if (start && end) {
          durations.push((end.getTime() - start.getTime()) / 60000)
        }
      }
      avgConsultationTime = durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 18
    } else {
      avgConsultationTime = 18
    }

    // Fix monthly revenue with proper date ranges
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
            where: {
              ...tenantFilter,
              status: 'Success',
              createdAt: { gte: startDate, lt: endDate },
            },
            _sum: { amount: true },
          })

          const monthNames = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
          ]
          const monthDate = new Date(`${month}-01`)
          return {
            month,
            label: `${monthNames[monthDate.getMonth()]} ${monthDate.getFullYear()}`,
            revenue: result._sum.amount ?? 0,
          }
        })
      })()
    )

    return NextResponse.json({
      data: {
        totalPatients,
        todayAppointments,
        todayRevenue: todayPaymentsResult._sum.amount ?? 0,
        outstandingPayments: parseFloat(totalOutstanding.toFixed(2)),
        recentAppointments,
        recentPayments,
        appointmentsByStatus: {
          Scheduled: scheduled,
          Completed: completed,
          Cancelled: cancelled,
          'No-Show': noShow,
        },
        monthlyRevenue,
        // ── Workflow metrics ──
        workflowMetrics: {
          activeVisits,
          todayRegistrations,
          visitsByStage,
          avgConsultationTime,
          todaysDischarges,
          opdVsIpd: { opd: opdCount, ipd: ipdCount },
        },
      },
    })
  } catch (error) {
    console.error('[DASHBOARD_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}