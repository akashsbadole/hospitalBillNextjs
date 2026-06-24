import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── Schemas ──────────────────────────────────────────────────────────────
const updateBranchSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200).optional(),
  code: z.string().trim().min(1, 'Code is required').max(20).optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  pincode: z.string().trim().max(10).optional(),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  gstin: z.string().trim().max(15).optional(),
  isHead: z.boolean().optional(),
  status: z.string().optional(),
})

type RouteParams = { params: Promise<{ id: string }> }

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateRequest(request, '/api/branches')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params

    const branch = await db.branch.findUnique({ where: { id } })
    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
    }

    // Get patient count for this branch
    const patientCount = await db.patient.count({ where: { branchId: id } })

    return NextResponse.json({ data: { ...branch, patientCount } })
  } catch (error) {
    console.error('[BRANCH_GET]', error)
    return NextResponse.json({ error: 'Failed to fetch branch' }, { status: 500 })
  }
}

// ── PUT ──────────────────────────────────────────────────────────────────
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateRequest(request, '/api/branches')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  if (auth.role !== 'Admin') {
    return NextResponse.json({ error: 'Only Admin can update branches' }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const data = updateBranchSchema.parse(body)

    const existing = await db.branch.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
    }

    // Check unique code if changed
    if (data.code && data.code.toUpperCase() !== existing.code) {
      const existingCode = await db.branch.findUnique({ where: { code: data.code.toUpperCase() } })
      if (existingCode) {
        return NextResponse.json({ error: `Branch code "${data.code}" already exists` }, { status: 409 })
      }
    }

    // If isHead, unset other head branches
    if (data.isHead && !existing.isHead) {
      await db.branch.updateMany({ where: { isHead: true }, data: { isHead: false } })
    }

    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.code !== undefined) updateData.code = data.code.toUpperCase()
    if (data.address !== undefined) updateData.address = data.address || null
    if (data.city !== undefined) updateData.city = data.city || null
    if (data.state !== undefined) updateData.state = data.state || null
    if (data.pincode !== undefined) updateData.pincode = data.pincode || null
    if (data.phone !== undefined) updateData.phone = data.phone || null
    if (data.email !== undefined) updateData.email = data.email || null
    if (data.gstin !== undefined) updateData.gstin = data.gstin || null
    if (data.isHead !== undefined) updateData.isHead = data.isHead
    if (data.status !== undefined) updateData.status = data.status

    const branch = await db.branch.update({ where: { id }, data: updateData })

    const reqInfo = extractRequestInfo(request)
    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'UPDATE',
      module: 'settings',
      details: { entity: 'Branch', branchId: branch.branchId, changes: data },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    })

    return NextResponse.json({ data: branch })
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors = error.flatten().fieldErrors
      const firstMessage = Object.values(fieldErrors).flat()[0]
      return NextResponse.json({ error: 'Validation failed', details: firstMessage }, { status: 400 })
    }
    console.error('[BRANCH_PUT]', error)
    return NextResponse.json({ error: 'Failed to update branch' }, { status: 500 })
  }
}

// ── DELETE ───────────────────────────────────────────────────────────────
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateRequest(request, '/api/branches')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  if (auth.role !== 'Admin') {
    return NextResponse.json({ error: 'Only Admin can deactivate branches' }, { status: 403 })
  }

  try {
    const { id } = await params

    const existing = await db.branch.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
    }

    if (existing.status === 'Inactive') {
      return NextResponse.json({ error: 'Branch is already inactive' }, { status: 400 })
    }

    // Check for active dependencies
    const [patientCount, activeAppointments, unpaidInvoices] = await Promise.all([
      db.patient.count({ where: { branchId: id, status: 'Active' } }),
      db.appointment.count({ where: { branchId: id, status: { in: ['Scheduled'] } } }),
      db.invoice.count({ where: { branchId: id, status: { in: ['Unpaid', 'Partially Paid'] } } }),
    ])

    if (activeAppointments > 0 || unpaidInvoices > 0) {
      return NextResponse.json(
        {
          error: 'Cannot deactivate branch with active dependencies',
          details: `${activeAppointments} scheduled appointments, ${unpaidInvoices} unpaid invoices. Complete or reassign them first.`,
        },
        { status: 409 }
      )
    }

    // Set status to Inactive
    const branch = await db.branch.update({ where: { id }, data: { status: 'Inactive' } })

    const reqInfo = extractRequestInfo(request)
    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'DELETE',
      module: 'settings',
      details: { entity: 'Branch', branchId: existing.branchId, name: existing.name, remainingPatients: patientCount },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    })

    return NextResponse.json({ data: branch })
  } catch (error) {
    console.error('[BRANCH_DELETE]', error)
    return NextResponse.json({ error: 'Failed to deactivate branch' }, { status: 500 })
  }
}
