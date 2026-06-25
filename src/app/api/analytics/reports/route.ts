import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generateReportId } from '@/lib/utils'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  type: z.string().min(1, 'Type is required'),
  parameters: z.any().optional(),
})

interface RevenueResult {
  totalRevenue: number
  totalInvoices: number
  totalPayments: number
  period: { from: string; to: string }
  byMethod: Record<string, number>
}

interface PatientVolumeResult {
  totalVisits: number
  period: { from: string; to: string }
  byVisitType: Record<string, number>
  byStage: Record<string, number>
}

async function generateRevenueReport(params: Record<string, string>): Promise<RevenueResult> {
  const dateFrom = params.dateFrom || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
  const dateTo = params.dateTo || new Date().toISOString().split('T')[0]

  const invoices = await db.invoice.findMany({
    where: {
      date: { gte: dateFrom, lte: dateTo },
      status: { not: 'Cancelled' },
    },
    select: { grandTotal: true, paidAmount: true, status: true },
  })

  const payments = await db.payment.findMany({
    where: {
      status: 'Success',
      createdAt: { gte: new Date(dateFrom), lte: new Date(dateTo + 'T23:59:59.999Z') },
    },
    select: { amount: true, method: true },
  })

  const byMethod: Record<string, number> = {}
  for (const p of payments) {
    byMethod[p.method] = (byMethod[p.method] || 0) + p.amount
  }

  return {
    totalRevenue: payments.reduce((s, p) => s + p.amount, 0),
    totalInvoices: invoices.length,
    totalPayments: payments.length,
    period: { from: dateFrom, to: dateTo },
    byMethod,
  }
}

async function generatePatientVolumeReport(params: Record<string, string>): Promise<PatientVolumeResult> {
  const dateFrom = params.dateFrom || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
  const dateTo = params.dateTo || new Date().toISOString().split('T')[0]

  const visits = await db.patientVisit.findMany({
    where: {
      createdAt: { gte: new Date(dateFrom), lte: new Date(dateTo + 'T23:59:59.999Z') },
    },
    select: { visitType: true, stage: true },
  })

  const byVisitType: Record<string, number> = {}
  const byStage: Record<string, number> = {}

  for (const v of visits) {
    byVisitType[v.visitType] = (byVisitType[v.visitType] || 0) + 1
    byStage[v.stage] = (byStage[v.stage] || 0) + 1
  }

  return {
    totalVisits: visits.length,
    period: { from: dateFrom, to: dateTo },
    byVisitType,
    byStage,
  }
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/analytics')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const type = searchParams.get('type')

    const where: Record<string, unknown> = {}
    if (type) where.type = type

    const reports = await db.analyticsReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: reports })
  } catch (error) {
    console.error('[REPORTS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch reports', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/analytics')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data
    const params = data.parameters || {}

    let result: RevenueResult | PatientVolumeResult | null = null
    if (data.type === 'revenue') {
      result = await generateRevenueReport(params)
    } else if (data.type === 'patient_volume') {
      result = await generatePatientVolumeReport(params)
    }

    const lastReport = await db.analyticsReport.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { reportId: true },
    })
    const reportId = generateReportId(lastReport?.reportId ?? null)

    const report = await db.analyticsReport.create({
      data: {
        reportId,
        name: data.name,
        description: data.description ?? null,
        type: data.type,
        parameters: data.parameters ? JSON.stringify(data.parameters) : null,
        result: result ? JSON.stringify(result) : null,
        lastRunAt: new Date(),
        createdBy: auth.userId,
      },
    })

    return NextResponse.json({ data: report }, { status: 201 })
  } catch (error) {
    console.error('[REPORTS_POST]', error)
    return NextResponse.json(
      { error: 'Failed to generate report', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
