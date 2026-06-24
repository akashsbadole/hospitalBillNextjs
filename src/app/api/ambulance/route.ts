import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const createAmbulanceSchema = z.object({
  vehicleNumber: z.string().trim().min(1, 'Vehicle number is required').max(50),
  driverName: z.string().trim().min(1, 'Driver name is required').max(100),
  driverPhone: z.string().trim().min(1, 'Driver phone is required').max(20),
  driverLicense: z.string().trim().max(50).optional(),
  type: z.enum(['Basic', 'Advanced', 'ICU', 'Mortuary']).default('Basic'),
  status: z.enum(['Available', 'On-Duty', 'Maintenance', 'Out-of-Service']).default('Available'),
  equipment: z.string().optional(),
  hospitalBranch: z.string().trim().max(200).optional(),
  insuranceValidUntil: z.string().optional(),
  fitnessValidUntil: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/ambulance')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { searchParams } = request.nextUrl
    const status = searchParams.get('status')?.trim() || ''
    const type = searchParams.get('type')?.trim() || ''

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (type) where.type = type

    const ambulances = await db.ambulance.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: ambulances })
  } catch (error) {
    console.error('[AMBULANCE_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch ambulances', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/ambulance')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createAmbulanceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await db.ambulance.findUnique({ where: { vehicleNumber: parsed.data.vehicleNumber } })
    if (existing) {
      return NextResponse.json(
        { error: 'Vehicle number already exists', details: `"${parsed.data.vehicleNumber}" is already registered.` },
        { status: 409 }
      )
    }

    const last = await db.ambulance.findFirst({ orderBy: { createdAt: 'desc' }, select: { ambulanceId: true } })
    const num = last ? parseInt(last.ambulanceId.replace('AMB-', ''), 10) + 1 : 1
    const ambulanceId = `AMB-${String(num).padStart(4, '0')}`

    const ambulance = await db.ambulance.create({
      data: {
        ...parsed.data,
        ambulanceId,
        insuranceValidUntil: parsed.data.insuranceValidUntil ? new Date(parsed.data.insuranceValidUntil) : undefined,
        fitnessValidUntil: parsed.data.fitnessValidUntil ? new Date(parsed.data.fitnessValidUntil) : undefined,
      } as any,
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'ambulance',
      details: { ambulanceId: ambulance.ambulanceId, vehicleNumber: ambulance.vehicleNumber },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: ambulance }, { status: 201 })
  } catch (error) {
    console.error('[AMBULANCE_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create ambulance', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
