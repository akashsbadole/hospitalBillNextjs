import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generateCampRegId } from '@/lib/utils'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const createSchema = z.object({
  campId: z.string().min(1, 'Camp is required'),
  patientId: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  age: z.number().int().optional(),
  gender: z.string().optional(),
  phone: z.string().min(1, 'Phone is required'),
  address: z.string().optional(),
  city: z.string().optional(),
  bloodGroup: z.string().optional(),
  bpSystolic: z.number().int().optional(),
  bpDiastolic: z.number().int().optional(),
  pulse: z.number().int().optional(),
  temperature: z.number().optional(),
  spo2: z.number().int().optional(),
  bloodSugar: z.number().optional(),
  weight: z.number().optional(),
  height: z.number().optional(),
  screeningResult: z.string().optional(),
  referredTo: z.string().optional(),
  findings: z.string().optional(),
  medicinesGiven: z.string().optional(),
  followUpNeeded: z.boolean().optional(),
  followUpNotes: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/camps')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const camp = await db.healthCamp.findUnique({ where: { id: data.campId } })
    if (!camp) return NextResponse.json({ error: 'Camp not found' }, { status: 404 })

    if (data.patientId) {
      const patient = await db.patient.findUnique({ where: { id: data.patientId } })
      if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const lastReg = await db.campRegistration.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { regId: true },
    })
    const regId = generateCampRegId(lastReg?.regId ?? null)

    const registration = await db.campRegistration.create({
      data: {
        regId,
        campId: data.campId,
        patientId: data.patientId ?? null,
        name: data.name,
        age: data.age ?? null,
        gender: data.gender ?? null,
        phone: data.phone,
        address: data.address ?? null,
        city: data.city ?? null,
        bloodGroup: data.bloodGroup ?? null,
        bpSystolic: data.bpSystolic ?? null,
        bpDiastolic: data.bpDiastolic ?? null,
        pulse: data.pulse ?? null,
        temperature: data.temperature ?? null,
        spo2: data.spo2 ?? null,
        bloodSugar: data.bloodSugar ?? null,
        weight: data.weight ?? null,
        height: data.height ?? null,
        screeningResult: data.screeningResult ?? null,
        referredTo: data.referredTo ?? null,
        findings: data.findings ?? null,
        medicinesGiven: data.medicinesGiven ?? null,
        followUpNeeded: data.followUpNeeded ?? false,
        followUpNotes: data.followUpNotes ?? null,
      },
      include: {
        camp: { select: { id: true, campId: true, name: true } },
        patient: { select: { id: true, patientId: true, name: true, phone: true } },
      },
    })

    await db.healthCamp.update({
      where: { id: data.campId },
      data: { actualCount: { increment: 1 } },
    })

    logAudit({
      userId: auth.userId!,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'feedback',
      details: { regId, campId: data.campId, patientName: data.name },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: registration }, { status: 201 })
  } catch (error) {
    console.error('[CAMP_REGISTER_POST]', error)
    return NextResponse.json(
      { error: 'Failed to register patient', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
