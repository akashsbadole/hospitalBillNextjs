import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'
import { updateLabTestOrderSchema } from '@/lib/validations'

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/lab-tests')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 })
    }

    const order = await db.labTestOrder.findUnique({
      where: { id },
      include: {
        patient: {
          select: { id: true, patientId: true, name: true, phone: true, email: true, gender: true, dateOfBirth: true },
        },
        test: {
          select: { id: true, testId: true, name: true, category: true, description: true, normalRange: true, unit: true, price: true },
        },
        doctor: {
          select: { id: true, doctorId: true, name: true, specialization: true, qualification: true },
        },
        visit: {
          select: { id: true, visitId: true, visitType: true, department: true, chiefComplaint: true, createdAt: true },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Lab test order not found' }, { status: 404 })
    }

    // Parse results JSON if present
    let parsedResults: unknown = null
    if (order.results) {
      try {
        parsedResults = JSON.parse(order.results)
      } catch {
        parsedResults = order.results
      }
    }

    return NextResponse.json({ data: { ...order, parsedResults } })
  } catch (error) {
    console.error('[LAB_TEST_ORDER_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch lab test order', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── PUT ──────────────────────────────────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/lab-tests')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateLabTestOrderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const existing = await db.labTestOrder.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Lab test order not found' }, { status: 404 })
    }

    // Build update data with timestamp logic
    const updateData: Record<string, unknown> = {}

    if (data.status) {
      updateData.status = data.status
    }

    // Set completedAt when status changes to Completed or Reported
    if (data.status && ['Completed', 'Reported'].includes(data.status) && !existing.completedAt) {
      updateData.completedAt = new Date()
    }

    // Store results as JSON string
    if (data.results) {
      updateData.results = JSON.stringify(data.results)
    }

    if (data.notes !== undefined) {
      updateData.notes = data.notes
    }

    if (data.reportUrl !== undefined) {
      updateData.reportUrl = data.reportUrl
    }

    const updated = await db.labTestOrder.update({
      where: { id },
      data: updateData,
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: existing.status !== updated.status ? 'STATUS_CHANGE' : 'UPDATE',
      module: 'lab-tests',
      details: {
        orderId: id,
        previousStatus: existing.status,
        newStatus: updated.status,
        hasResults: !!data.results,
        changedFields: Object.keys(data),
      },
      ...extractRequestInfo(request),
    })

    // Return with parsed results
    let parsedResults: unknown = null
    if (updated.results) {
      try {
        parsedResults = JSON.parse(updated.results)
      } catch {
        parsedResults = updated.results
      }
    }

    return NextResponse.json({ data: { ...updated, parsedResults } })
  } catch (error) {
    console.error('[LAB_TEST_ORDER_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update lab test order', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}