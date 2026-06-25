import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const createIOSchema = z.object({
  patientId: z.string().trim().min(1, 'Patient ID is required'),
  visitId: z.string().trim().optional(),
  type: z.string().trim().min(1, 'Type is required'),
  category: z.enum(['Intake', 'Output'], { message: 'Category must be Intake or Output' }),
  amount: z.number().positive('Amount must be positive'),
  recordTime: z.string().optional(),
  recordedBy: z.string().trim().optional(),
  notes: z.string().trim().optional(),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/intake-output')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const patientId = searchParams.get('patientId')
    const visitId = searchParams.get('visitId')
    const date = searchParams.get('date')

    const where: Record<string, unknown> = {}
    if (patientId) where.patientId = patientId
    if (visitId) where.visitId = visitId
    if (date) {
      const start = new Date(date)
      start.setHours(0, 0, 0, 0)
      const end = new Date(date)
      end.setHours(23, 59, 59, 999)
      where.recordTime = { gte: start, lte: end }
    }

    const records = await db.intakeOutput.findMany({
      where,
      orderBy: { recordTime: 'desc' },
      include: {
        patient: { select: { id: true, patientId: true, name: true } },
        visit: { select: { id: true, visitId: true, visitType: true } },
      },
    })

    return NextResponse.json({ data: records })
  } catch (error) {
    console.error('[INTAKE_OUTPUT_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch intake/output records', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/intake-output')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createIOSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const patient = await db.patient.findUnique({ where: { id: data.patientId } })
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const intakeOutput = await db.intakeOutput.create({
      data: {
        patientId: data.patientId,
        visitId: data.visitId ?? null,
        type: data.type,
        category: data.category,
        amount: data.amount,
        recordTime: data.recordTime ? new Date(data.recordTime) : undefined,
        recordedBy: data.recordedBy ?? null,
        notes: data.notes ?? null,
      },
      include: {
        patient: { select: { id: true, patientId: true, name: true } },
        visit: { select: { id: true, visitId: true, visitType: true } },
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'patients',
      details: { intakeOutputId: intakeOutput.id, patientId: data.patientId },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: intakeOutput }, { status: 201 })
  } catch (error) {
    console.error('[INTAKE_OUTPUT_POST]', error)
    return NextResponse.json(
      { error: 'Failed to record intake/output', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
