import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generatePrescriptionId } from '@/lib/utils'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── Schemas ──────────────────────────────────────────────────────────────
const prescriptionItemSchema = z.object({
  medicine: z.string().trim().min(1, 'Medicine name is required'),
  medicineId: z.string().optional(),
  dosage: z.string().trim().optional(),
  frequency: z.string().trim().optional(),
  duration: z.string().trim().optional(),
})

const createPrescriptionSchema = z.object({
  patientId: z.string().trim().min(1, 'Patient ID is required'),
  doctorId: z.string().trim().min(1, 'Doctor ID is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  diagnosis: z.string().trim().optional(),
  notes: z.array(prescriptionItemSchema).optional(),
})

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/prescriptions')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const doctorId = searchParams.get('doctorId')
    const patientId = searchParams.get('patientId')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    if (fromDate && !/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
      return NextResponse.json({ error: 'Invalid fromDate format', details: 'Must be YYYY-MM-DD' }, { status: 400 })
    }
    if (toDate && !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      return NextResponse.json({ error: 'Invalid toDate format', details: 'Must be YYYY-MM-DD' }, { status: 400 })
    }

    const where: Record<string, unknown> = {}
    if (doctorId) where.doctorId = doctorId
    if (patientId) where.patientId = patientId
    if (fromDate || toDate) {
      const dateFilter: Record<string, unknown> = {}
      if (fromDate) dateFilter.gte = fromDate
      if (toDate) dateFilter.lte = toDate
      where.date = dateFilter
    }

    const [prescriptions, total] = await Promise.all([
      db.prescription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          patient: { select: { id: true, patientId: true, name: true, phone: true } },
          doctor: { select: { id: true, doctorId: true, name: true, specialization: true } },
        },
      }),
      db.prescription.count({ where }),
    ])

    return NextResponse.json({
      data: prescriptions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[PRESCRIPTIONS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch prescriptions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── POST ─────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/prescriptions')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()

    const parsed = createPrescriptionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Check patient and doctor exist
    const [patient, doctor] = await Promise.all([
      db.patient.findUnique({ where: { id: data.patientId } }),
      db.doctor.findUnique({ where: { id: data.doctorId } }),
    ])

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }
    if (!doctor) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }

    // Auto-generate prescription ID
    const lastPrescription = await db.prescription.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { prescriptionId: true },
    })
    const prescriptionId = generatePrescriptionId(lastPrescription?.prescriptionId ?? null)

    const prescription = await db.prescription.create({
      data: {
        prescriptionId,
        patientId: data.patientId,
        doctorId: data.doctorId,
        date: data.date,
        diagnosis: data.diagnosis ?? null,
        notes: data.notes ? JSON.stringify(data.notes) : null,
      },
      include: {
        patient: { select: { id: true, patientId: true, name: true, phone: true } },
        doctor: { select: { id: true, doctorId: true, name: true, specialization: true } },
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'prescriptions',
      details: { prescriptionId: prescription.prescriptionId, patientId: data.patientId, date: data.date },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: prescription }, { status: 201 })
  } catch (error) {
    console.error('[PRESCRIPTIONS_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create prescription', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
