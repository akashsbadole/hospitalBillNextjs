import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── Schemas ──────────────────────────────────────────────────────────────
const updatePatientSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200).optional(),
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().trim().min(1, 'Phone is required').max(20).optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['Male', 'Female', 'Other']).optional(),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']).optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  pincode: z.string().trim().max(10).optional(),
  aadhaarNumber: z.string().trim().max(12).optional(),
  emergencyContact: z.string().trim().optional(),
  emergencyPhone: z.string().trim().max(20).optional(),
  allergies: z.array(z.string()).optional(),
  pastTreatments: z.array(z.string()).optional(),
  insuranceProvider: z.string().trim().optional(),
  insuranceNumber: z.string().trim().optional(),
  maritalStatus: z.enum(['Single', 'Married', 'Divorced', 'Widowed']).optional(),
  occupation: z.string().trim().optional(),
  status: z.enum(['Active', 'Inactive', 'Archived']).optional(),
})

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/patients')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 })
    }

    const patient = await db.patient.findUnique({
      where: { id },
      include: {
        appointments: { orderBy: { date: 'desc' } },
        invoices: { orderBy: { date: 'desc' } },
        prescriptions: { orderBy: { date: 'desc' } },
      },
    })

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    return NextResponse.json({ data: patient })
  } catch (error) {
    console.error('[PATIENT_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch patient', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── PUT ──────────────────────────────────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/patients')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updatePatientSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Verify patient exists
    const existing = await db.patient.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const updatedPatient = await db.patient.update({
      where: { id },
      data: {
        ...data,
        email: data.email === '' ? null : data.email,
        allergies: data.allergies !== undefined ? JSON.stringify(data.allergies) : undefined,
        pastTreatments: data.pastTreatments !== undefined ? JSON.stringify(data.pastTreatments) : undefined,
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'UPDATE',
      module: 'patients',
      details: { patientId: id, name: updatedPatient.name, changedFields: Object.keys(data) },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: updatedPatient })
  } catch (error) {
    console.error('[PATIENT_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update patient', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── DELETE (soft delete) ────────────────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/patients')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'DELETE')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 })
    }

    const existing = await db.patient.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    if (existing.status === 'Archived') {
      return NextResponse.json({ error: 'Patient is already archived' }, { status: 400 })
    }

    const patient = await db.patient.update({
      where: { id },
      data: { status: 'Archived' },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'DELETE',
      module: 'patients',
      details: { patientId: id, name: patient.name, patientIdDisplay: existing.patientId },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: patient })
  } catch (error) {
    console.error('[PATIENT_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to archive patient', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
