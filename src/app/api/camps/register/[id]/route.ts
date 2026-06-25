import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  age: z.number().int().nullable().optional(),
  gender: z.string().nullable().optional(),
  phone: z.string().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  bloodGroup: z.string().nullable().optional(),
  bpSystolic: z.number().int().nullable().optional(),
  bpDiastolic: z.number().int().nullable().optional(),
  pulse: z.number().int().nullable().optional(),
  temperature: z.number().nullable().optional(),
  spo2: z.number().int().nullable().optional(),
  bloodSugar: z.number().nullable().optional(),
  weight: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  screeningResult: z.string().nullable().optional(),
  referredTo: z.string().nullable().optional(),
  findings: z.string().nullable().optional(),
  medicinesGiven: z.string().nullable().optional(),
  followUpNeeded: z.boolean().optional(),
  followUpNotes: z.string().nullable().optional(),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request, '/api/camps')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    const registration = await db.campRegistration.findUnique({
      where: { id },
      include: {
        camp: { select: { id: true, campId: true, name: true, campDate: true, location: true } },
        patient: { select: { id: true, patientId: true, name: true, phone: true } },
      },
    })
    if (!registration) return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
    return NextResponse.json({ data: registration })
  } catch (error) {
    console.error('[CAMP_REGISTRATION_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch registration', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request, '/api/camps')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await db.campRegistration.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Registration not found' }, { status: 404 })

    const registration = await db.campRegistration.update({ where: { id }, data: parsed.data })

    logAudit({
      userId: auth.userId!,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'UPDATE',
      module: 'feedback',
      details: { regId: registration.regId, screeningResult: registration.screeningResult },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: registration })
  } catch (error) {
    console.error('[CAMP_REGISTRATION_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update registration', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request, '/api/camps')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'DELETE')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    const existing = await db.campRegistration.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Registration not found' }, { status: 404 })

    await db.campRegistration.delete({ where: { id } })

    await db.healthCamp.update({
      where: { id: existing.campId },
      data: { actualCount: { decrement: 1 } },
    })

    logAudit({
      userId: auth.userId!,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'DELETE',
      module: 'feedback',
      details: { regId: existing.regId, campId: existing.campId },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: { id }, message: 'Registration deleted successfully' })
  } catch (error) {
    console.error('[CAMP_REGISTRATION_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete registration', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
