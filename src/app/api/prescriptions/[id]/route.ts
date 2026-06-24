import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── Schemas ──────────────────────────────────────────────────────────────
const prescriptionItemSchema = z.object({
  medicine: z.string().trim().min(1, 'Medicine name is required'),
  dosage: z.string().trim().optional(),
  frequency: z.string().trim().optional(),
  duration: z.string().trim().optional(),
})

const updatePrescriptionSchema = z.object({
  diagnosis: z.string().trim().optional(),
  notes: z.array(prescriptionItemSchema).optional(),
})

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/prescriptions')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Prescription ID is required' }, { status: 400 })
    }

    const prescription = await db.prescription.findUnique({
      where: { id },
      include: {
        patient: {
          select: { id: true, patientId: true, name: true, phone: true, email: true, dateOfBirth: true, gender: true },
        },
        doctor: {
          select: { id: true, doctorId: true, name: true, specialization: true, qualification: true },
        },
      },
    })

    if (!prescription) {
      return NextResponse.json({ error: 'Prescription not found' }, { status: 404 })
    }

    return NextResponse.json({ data: prescription })
  } catch (error) {
    console.error('[PRESCRIPTION_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch prescription', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── PUT ──────────────────────────────────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/prescriptions')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Prescription ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updatePrescriptionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const existing = await db.prescription.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Prescription not found' }, { status: 404 })
    }

    const updated = await db.prescription.update({
      where: { id },
      data: {
        diagnosis: data.diagnosis !== undefined ? (data.diagnosis || null) : undefined,
        notes: data.notes !== undefined ? JSON.stringify(data.notes) : undefined,
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
      action: 'UPDATE',
      module: 'prescriptions',
      details: {
        prescriptionId: id,
        patientName: updated.patient.name,
        doctorName: updated.doctor.name,
        changedFields: Object.keys(data),
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[PRESCRIPTION_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update prescription', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// No DELETE — prescriptions are medical records and must be preserved
