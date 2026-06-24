import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as const

const updateStockSchema = z.object({
  bloodGroup: z.enum(BLOOD_GROUPS),
  unitsAvailable: z.number().int().min(0, 'Units cannot be negative'),
  minStock: z.number().int().min(0).optional(),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/blood-bank')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const inventory = await db.bloodInventory.findMany({
      orderBy: { bloodGroup: 'asc' },
    })

    const stats = {
      totalUnits: inventory.reduce((sum, i) => sum + i.unitsAvailable, 0),
      lowStockGroups: inventory.filter((i) => i.unitsAvailable <= i.minStock).length,
      bloodGroups: BLOOD_GROUPS.length,
    }

    return NextResponse.json({ data: inventory, stats })
  } catch (error) {
    console.error('[BLOOD_INVENTORY_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/blood-bank')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = updateStockSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const inventory = await db.bloodInventory.upsert({
      where: { bloodGroup: data.bloodGroup },
      update: {
        unitsAvailable: data.unitsAvailable,
        ...(data.minStock !== undefined ? { minStock: data.minStock } : {}),
      },
      create: {
        bloodGroup: data.bloodGroup,
        unitsAvailable: data.unitsAvailable,
        minStock: data.minStock ?? 5,
      },
    })

    logAudit({
      userId: auth.userId!,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'UPDATE',
      module: 'blood-bank',
      details: { bloodGroup: data.bloodGroup, unitsAvailable: data.unitsAvailable },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: inventory })
  } catch (error) {
    console.error('[BLOOD_INVENTORY_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update inventory', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
