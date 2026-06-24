import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as const
const DONOR_STATUSES = ['Active', 'Deferred', 'Inactive'] as const

const updateDonorSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  phone: z.string().trim().min(1).max(20).optional(),
  email: z.string().email().optional().or(z.literal('')),
  bloodGroup: z.enum(BLOOD_GROUPS).optional(),
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  weight: z.number().min(1).max(300).optional(),
  medicalNotes: z.string().trim().max(2000).optional(),
  status: z.enum(DONOR_STATUSES).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/blood-bank')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Donor ID is required' }, { status: 400 })
    }

    const donor = await db.bloodDonor.findUnique({
      where: { id },
      include: {
        donations: {
          orderBy: { donationDate: 'desc' },
          take: 50,
        },
        _count: { select: { donations: true } },
      },
    })

    if (!donor) {
      return NextResponse.json({ error: 'Donor not found' }, { status: 404 })
    }

    return NextResponse.json({ data: donor })
  } catch (error) {
    console.error('[BLOOD_DONOR_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch donor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/blood-bank')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Donor ID is required' }, { status: 400 })
    }

    const existing = await db.bloodDonor.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Donor not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = updateDonorSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data
    const updateData: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        updateData[key] = value === '' && ['email'].includes(key) ? null : value
      }
    }

    const donor = await db.bloodDonor.update({
      where: { id },
      data: updateData,
    })

    logAudit({
      userId: auth.userId!,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'UPDATE',
      module: 'blood-bank',
      details: { donorId: donor.donorId, changedFields: Object.keys(data) },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: donor })
  } catch (error) {
    console.error('[BLOOD_DONOR_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update donor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/blood-bank')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'DELETE')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Donor ID is required' }, { status: 400 })
    }

    const existing = await db.bloodDonor.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Donor not found' }, { status: 404 })
    }

    // Soft delete — mark as Inactive
    const donor = await db.bloodDonor.update({
      where: { id },
      data: { status: 'Inactive' },
    })

    logAudit({
      userId: auth.userId!,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'DELETE',
      module: 'blood-bank',
      details: { donorId: donor.donorId, name: donor.name },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: donor })
  } catch (error) {
    console.error('[BLOOD_DONOR_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to deactivate donor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
