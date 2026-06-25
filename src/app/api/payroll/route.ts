import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generatePayrollId } from '@/lib/utils'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const createPayrollSchema = z.object({
  staffId: z.string().trim().min(1, 'Staff ID is required'),
  month: z.number().int().min(1, 'Month must be 1-12').max(12),
  year: z.number().int().min(2020, 'Year must be 2020 or later').max(2100),
  basicSalary: z.number().min(0).default(0),
  hra: z.number().min(0).default(0),
  conveyance: z.number().min(0).default(0),
  medicalAllowance: z.number().min(0).default(0),
  specialAllowance: z.number().min(0).default(0),
  overtimePay: z.number().min(0).default(0),
  bonus: z.number().min(0).default(0),
  pfDeduction: z.number().min(0).default(0),
  esiDeduction: z.number().min(0).default(0),
  professionalTax: z.number().min(0).default(0),
  incomeTax: z.number().min(0).default(0),
  loanDeduction: z.number().min(0).default(0),
  otherDeductions: z.number().min(0).default(0),
  notes: z.string().trim().optional(),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/payroll')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const staffId = searchParams.get('staffId')
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const status = searchParams.get('status')

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (staffId) where.staffId = staffId
    if (month) where.month = parseInt(month, 10)
    if (year) where.year = parseInt(year, 10)
    if (status) where.status = status

    const [payrolls, total] = await Promise.all([
      db.payroll.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        include: {
          staff: { select: { id: true, staffId: true, name: true, role: true, designation: true } },
        },
      }),
      db.payroll.count({ where }),
    ])

    return NextResponse.json({
      data: payrolls,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[PAYROLL_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch payroll records', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/payroll')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createPayrollSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const staff = await db.staff.findUnique({ where: { id: data.staffId } })
    if (!staff) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
    }

    const existing = await db.payroll.findUnique({
      where: { staffId_month_year: { staffId: data.staffId, month: data.month, year: data.year } },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'Payroll record already exists for this staff member in the given month and year' },
        { status: 409 }
      )
    }

    const grossEarnings =
      data.basicSalary + data.hra + data.conveyance + data.medicalAllowance + data.specialAllowance + data.overtimePay + data.bonus
    const totalDeductions =
      data.pfDeduction + data.esiDeduction + data.professionalTax + data.incomeTax + data.loanDeduction + data.otherDeductions
    const netPay = grossEarnings - totalDeductions

    const lastPayroll = await db.payroll.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { payrollId: true },
    })
    const payrollId = generatePayrollId(lastPayroll?.payrollId ?? null)

    const payroll = await db.payroll.create({
      data: {
        payrollId,
        staffId: data.staffId,
        month: data.month,
        year: data.year,
        basicSalary: data.basicSalary,
        hra: data.hra,
        conveyance: data.conveyance,
        medicalAllowance: data.medicalAllowance,
        specialAllowance: data.specialAllowance,
        overtimePay: data.overtimePay,
        bonus: data.bonus,
        pfDeduction: data.pfDeduction,
        esiDeduction: data.esiDeduction,
        professionalTax: data.professionalTax,
        incomeTax: data.incomeTax,
        loanDeduction: data.loanDeduction,
        otherDeductions: data.otherDeductions,
        grossEarnings,
        totalDeductions,
        netPay,
        notes: data.notes ?? null,
      },
      include: {
        staff: { select: { id: true, staffId: true, name: true, role: true, designation: true } },
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'payroll' as any,
      details: { payrollId: payroll.payrollId, staffId: data.staffId, month: data.month, year: data.year },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: payroll }, { status: 201 })
  } catch (error) {
    console.error('[PAYROLL_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create payroll record', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
