import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const receiveItemSchema = z.object({
  itemId: z.string().min(1, 'Item ID is required'),
  receivedQty: z.number().int().min(1, 'Received quantity must be at least 1'),
})

const receiveBodySchema = z.object({
  items: z.array(receiveItemSchema).min(1, 'At least one item is required'),
})

// ── POST: Receive Items ────────────────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/inventory/purchase-orders')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    const body = await request.json()
    const parsed = receiveBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    // Fetch PO with items
    const po = await db.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    })
    if (!po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    if (po.status === 'Received' || po.status === 'Cancelled') {
      return NextResponse.json(
        { error: `Cannot receive items for a ${po.status} purchase order` },
        { status: 400 }
      )
    }

    if (po.status === 'Draft') {
      return NextResponse.json(
        { error: 'Please submit or approve the purchase order before receiving items' },
        { status: 400 }
      )
    }

    // Validate items and quantities
    const itemMap = new Map(po.items.map((item) => [item.id, item]))
    for (const reqItem of parsed.data.items) {
      const poItem = itemMap.get(reqItem.itemId)
      if (!poItem) {
        return NextResponse.json({ error: `Item ${reqItem.itemId} not found in this purchase order` }, { status: 400 })
      }
      const newReceivedQty = poItem.receivedQty + reqItem.receivedQty
      if (newReceivedQty > poItem.quantity) {
        return NextResponse.json(
          { error: `Cannot receive more than ordered quantity for item. Ordered: ${poItem.quantity}, Already received: ${poItem.receivedQty}, Requested: ${reqItem.receivedQty}` },
          { status: 400 }
        )
      }
    }

    // Get the last SM ID for generation
    const lastSM = await db.stockMovement.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { movementId: true },
    })

    let movementCounter = lastSM ? parseInt(lastSM.movementId.replace('SM-', ''), 10) : 0

    // Execute in a transaction
    const result = await db.$transaction(async (tx) => {
      let totalReceivedAmount = 0
      const updatedItems: { id: string; receivedQty: number; quantity: number }[] = []

      for (const reqItem of parsed.data.items) {
        const poItem = itemMap.get(reqItem.itemId)!

        // Update PO item receivedQty
        const newReceivedQty = poItem.receivedQty + reqItem.receivedQty
        await tx.purchaseOrderItem.update({
          where: { id: reqItem.itemId },
          data: { receivedQty: newReceivedQty },
        })

        // Update medicine stock
        await tx.medicine.update({
          where: { id: poItem.medicineId },
          data: { stock: { increment: reqItem.receivedQty } },
        })

        // Create stock movement
        movementCounter++
        const movementId = `SM-${String(movementCounter).padStart(4, '0')}`
        await tx.stockMovement.create({
          data: {
            movementId,
            medicineId: poItem.medicineId,
            type: 'Purchase',
            quantity: reqItem.receivedQty,
            referenceId: po.poId,
            notes: `Received via PO ${po.poId}`,
          },
        })

        totalReceivedAmount += reqItem.receivedQty * poItem.unitPrice
        updatedItems.push({ id: reqItem.itemId, receivedQty: newReceivedQty, quantity: poItem.quantity })
      }

      // Determine new PO status
      const allItems = await tx.purchaseOrderItem.findMany({
        where: { poId: id },
      })

      const allFullyReceived = allItems.every((item) => item.receivedQty >= item.quantity)
      const someReceived = allItems.some((item) => item.receivedQty > 0)

      let newStatus = po.status
      if (allFullyReceived) {
        newStatus = 'Received'
      } else if (someReceived) {
        newStatus = 'Partially Received'
      }

      // Update PO status and receivedAmount
      const updatedPO = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: newStatus,
          receivedAmount: po.receivedAmount + totalReceivedAmount,
        },
        include: {
          supplier: { select: { id: true, supplierId: true, name: true, contact: true, email: true } },
          items: { include: { medicine: { select: { id: true, medicineId: true, name: true } } } },
        },
      })

      return updatedPO
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'UPDATE',
      module: 'medicines',
      details: { poId: result.poId, action: 'items_received', itemCount: parsed.data.items.length },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('[PURCHASE_ORDER_RECEIVE]', error)
    return NextResponse.json(
      { error: 'Failed to receive items', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}