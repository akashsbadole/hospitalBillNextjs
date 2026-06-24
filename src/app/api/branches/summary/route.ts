import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/branches')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const branches = await db.branch.findMany({
      where: { status: 'Active' },
      orderBy: [{ isHead: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        branchId: true,
        name: true,
        code: true,
        city: true,
        isHead: true,
        status: true,
      },
    })

    const today = new Date().toISOString().split('T')[0]
    const currentMonth = today.substring(0, 7) // YYYY-MM

    const summaries = await Promise.all(
      branches.map(async (branch) => {
        const [patientCount, todayAppointments, monthlyRevenue, outstanding] = await Promise.all([
          db.patient.count({ where: { branchId: branch.id, status: 'Active' } }),
          db.appointment.count({ where: { branchId: branch.id, date: today, status: { not: 'Cancelled' } } }),
          db.invoice.aggregate({
            where: { branchId: branch.id, date: { startsWith: currentMonth } },
            _sum: { grandTotal: true },
          }),
          db.invoice.aggregate({
            where: {
              branchId: branch.id,
              status: { in: ['Unpaid', 'Partially Paid', 'Overdue'] },
            },
            _sum: { grandTotal: true },
          }),
        ])

        return {
          ...branch,
          patientCount,
          todayAppointments,
          monthlyRevenue: monthlyRevenue._sum.grandTotal || 0,
          outstanding: outstanding._sum.grandTotal || 0,
        }
      })
    )

    return NextResponse.json({ data: summaries })
  } catch (error) {
    console.error('[BRANCH_SUMMARY]', error)
    return NextResponse.json({ error: 'Failed to fetch branch summary' }, { status: 500 })
  }
}
