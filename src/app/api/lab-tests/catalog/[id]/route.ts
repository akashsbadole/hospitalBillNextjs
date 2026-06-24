import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'
import { updateLabTestCatalogSchema } from '@/lib/validations'

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
      return NextResponse.json({ error: 'Test ID is required' }, { status: 400 })
    }

    const test = await db.labTestCatalog.findUnique({
      where: { id },
      include: {
        _count: { select: { orders: true } },
      },
    })

    if (!test) {
      return NextResponse.json({ error: 'Lab test not found' }, { status: 404 })
    }

    // Include recent orders for context
    const recentOrders = await db.labTestOrder.findMany({
      where: { testId: id },
      orderBy: { orderedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        orderId: true,
        status: true,
        orderedAt: true,
        patient: { select: { name: true, patientId: true } },
      },
    })

    return NextResponse.json({ data: { ...test, recentOrders } })
  } catch (error) {
    console.error('[LAB_TEST_CATALOG_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch lab test', details: error instanceof Error ? error.message : 'Unknown error' },
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
      return NextResponse.json({ error: 'Test ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateLabTestCatalogSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const existing = await db.labTestCatalog.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Lab test not found' }, { status: 404 })
    }

    const updated = await db.labTestCatalog.update({
      where: { id },
      data,
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'UPDATE',
      module: 'lab-tests',
      details: { testId: id, name: updated.name, changedFields: Object.keys(data) },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[LAB_TEST_CATALOG_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update lab test', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── DELETE (soft delete → Inactive) ─────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/lab-tests')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'DELETE')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Test ID is required' }, { status: 400 })
    }

    const existing = await db.labTestCatalog.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Lab test not found' }, { status: 404 })
    }

    if (existing.status === 'Inactive') {
      return NextResponse.json({ error: 'Lab test is already inactive' }, { status: 400 })
    }

    // Check for active orders
    const activeOrders = await db.labTestOrder.count({
      where: { testId: id, status: { notIn: ['Completed', 'Reported'] } },
    })
    if (activeOrders > 0) {
      return NextResponse.json(
        { error: 'Cannot deactivate test with active orders', details: `${activeOrders} active order(s) exist` },
        { status: 400 }
      )
    }

    const test = await db.labTestCatalog.update({
      where: { id },
      data: { status: 'Inactive' },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'DELETE',
      module: 'lab-tests',
      details: { testId: id, name: test.name },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: test })
  } catch (error) {
    console.error('[LAB_TEST_CATALOG_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to deactivate lab test', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}