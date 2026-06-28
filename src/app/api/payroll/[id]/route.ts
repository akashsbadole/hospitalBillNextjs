import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const VALID_STATUSES = ['Draft', 'Calculated', 'Approved', 'Paid', 'Cancelled'] as const

const updatePayrollSchema = z.object({
  staffId: z.string().trim().min(1).optional(),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2020).max(2100).optional(),
  basicSalary: z.number().min(0).optional(),
  hra: z.number().min(0).optional(),
  conveyance: z.number().min(0).optional(),
  medicalAllowance: z.number().min(0).optional(),
  specialAllowance: z.number().min(0).optional(),
  overtimePay: z.number().min(0).optional(),
  bonus: z.number().min(0).optional(),
  pfDeduction: z.number().min(0).optional(),
  esiDeduction: z.number().min(0).optional(),
  professionalTax: z.number().min(0).optional(),
  incomeTax: z.number().min(0).optional(),
  loanDeduction: z.number().min(0).optional(),
  otherDeductions: z.number().min(0).optional(),
  status: z.enum(VALID_STATUSES).optional(),
  paymentMethod: z.string().trim().optional(),
  transactionRef: z.string().trim().optional(),
  notes: z.string().trim().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/payroll')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Payroll ID is required' }, { status: 400 })
    }

    const payroll = await db.payroll.findUnique({
      where: { id },
      include: {
        staff: { select: { id: true, staffId: true, name: true, role: true, designation: true, department: true } },
      },
    })

    if (!payroll) {
      return NextResponse.json({ error: 'Payroll record not found' }, { status: 404 })
    }

    return NextResponse.json({ data: payroll })
  } catch (error) {
    console.error('[PAYROLL_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch payroll record', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/payroll')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Payroll ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updatePayrollSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await db.payroll.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Payroll record not found' }, { status: 404 })
    }

    const data = parsed.data
    const updateData: Record<string, unknown> = {}

    const earningsFields = ['basicSalary', 'hra', 'conveyance', 'medicalAllowance', 'specialAllowance', 'overtimePay', 'bonus'] as const
    const deductionFields = ['pfDeduction', 'esiDeduction', 'professionalTax', 'incomeTax', 'loanDeduction', 'otherDeductions'] as const

    let recalcEarnings = false
    let recalcDeductions = false

    for (const field of earningsFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field]
        recalcEarnings = true
      }
    }
    for (const field of deductionFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field]
        recalcDeductions = true
      }
    }

    if (data.notes !== undefined) updateData.notes = data.notes

    if (data.status) {
      updateData.status = data.status
      if (data.status === 'Paid') {
        updateData.paidAt = new Date()
        if (data.paymentMethod) updateData.paymentMethod = data.paymentMethod
        if (data.transactionRef) updateData.transactionRef = data.transactionRef
      }
    }

    if (data.staffId !== undefined) updateData.staffId = data.staffId
    if (data.month !== undefined) updateData.month = data.month
    if (data.year !== undefined) updateData.year = data.year

    if (recalcEarnings || recalcDeductions) {
      const currentBasic = data.basicSalary ?? existing.basicSalary
      const currentHra = data.hra ?? existing.hra
      const currentConveyance = data.conveyance ?? existing.conveyance
      const currentMedical = data.medicalAllowance ?? existing.medicalAllowance
      const currentSpecial = data.specialAllowance ?? existing.specialAllowance
      const currentOvertime = data.overtimePay ?? existing.overtimePay
      const currentBonus = data.bonus ?? existing.bonus

      const currentPf = data.pfDeduction ?? existing.pfDeduction
      const currentEsi = data.esiDeduction ?? existing.esiDeduction
      const currentPTax = data.professionalTax ?? existing.professionalTax
      const currentITax = data.incomeTax ?? existing.incomeTax
      const currentLoan = data.loanDeduction ?? existing.loanDeduction
      const currentOther = data.otherDeductions ?? existing.otherDeductions

      if (recalcEarnings) {
        updateData.grossEarnings = currentBasic + currentHra + currentConveyance + currentMedical + currentSpecial + currentOvertime + currentBonus
      }
      if (recalcDeductions) {
        updateData.totalDeductions = currentPf + currentEsi + currentPTax + currentITax + currentLoan + currentOther
      }
      updateData.netPay = (updateData.grossEarnings as number ?? existing.grossEarnings) - (updateData.totalDeductions as number ?? existing.totalDeductions)
    }

    const updated = await db.payroll.update({
      where: { id },
      data: updateData,
      include: {
        staff: { select: { id: true, staffId: true, name: true, role: true, designation: true } },
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'UPDATE',
      module: 'payroll',
      details: { payrollId: id, changedFields: Object.keys(data) },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[PAYROLL_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update payroll record', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/payroll')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'DELETE')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Payroll ID is required' }, { status: 400 })
    }

    const existing = await db.payroll.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Payroll record not found' }, { status: 404 })
    }

    await db.payroll.delete({ where: { id } })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'DELETE',
      module: 'payroll',
      details: { payrollId: existing.payrollId, staffId: existing.staffId, month: existing.month, year: existing.year },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ message: 'Payroll record deleted successfully' })
  } catch (error) {
    console.error('[PAYROLL_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete payroll record', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
