import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'
import { authenticateRequest } from '@/lib/api-auth'
import { z } from 'zod'

const registerSchema = z.object({
  patientId: z.string().trim().min(1, 'Patient ID is required'),
  email: z.string().email().optional(),
  phone: z.string().trim().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
}).refine(data => data.email || data.phone, {
  message: 'Email or phone is required',
})

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/portal/register')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const body = await request.json()
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { patientId, email, phone, password } = parsed.data

    const patient = await db.patient.findUnique({ where: { patientId } })
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const existing = await db.portalUser.findFirst({
      where: {
        OR: [
          { patientId },
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
    })
    if (existing) {
      if (existing.patientId === patientId) {
        return NextResponse.json({ error: 'Portal account already exists for this patient' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Email or phone already registered' }, { status: 409 })
    }

    const passwordHash = await hashPassword(password)

    const portalUser = await db.portalUser.create({
      data: {
        patientId,
        email: email ?? null,
        phone: phone ?? null,
        passwordHash,
        isVerified: true,
      },
      include: {
        patient: {
          select: { id: true, patientId: true, name: true, email: true, phone: true },
        },
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'auth',
      details: { portalUserId: portalUser.id, patientId },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: { id: portalUser.id, patient: portalUser.patient } }, { status: 201 })
  } catch (error) {
    console.error('[PORTAL_REGISTER_POST]', error)
    return NextResponse.json(
      { error: 'Registration failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
