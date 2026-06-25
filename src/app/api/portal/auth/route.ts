import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { comparePassword, signToken } from '@/lib/auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().trim().optional(),
  password: z.string().min(1, 'Password is required'),
}).refine(data => data.email || data.phone, {
  message: 'Email or phone is required',
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { email, phone, password } = parsed.data

    const portalUser = await db.portalUser.findFirst({
      where: email ? { email } : { phone },
      include: {
        patient: {
          select: { id: true, patientId: true, name: true, email: true, phone: true },
        },
      },
    })

    if (!portalUser) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const valid = await comparePassword(password, portalUser.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    await db.portalUser.update({
      where: { id: portalUser.id },
      data: { lastLoginAt: new Date() },
    })

    const token = signToken({
      id: portalUser.id,
      userId: portalUser.patientId,
      email: portalUser.email || `${portalUser.patientId}@portal`,
      role: 'Patient',
    })

    logAudit({
      userId: portalUser.id,
      userName: portalUser.patient.name,
      userEmail: portalUser.email || '',
      userRole: 'Patient',
      action: 'LOGIN',
      module: 'auth',
      details: { portalUserId: portalUser.id, patientId: portalUser.patientId },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({
      data: {
        token,
        patient: portalUser.patient,
        isVerified: portalUser.isVerified,
      },
    })
  } catch (error) {
    console.error('[PORTAL_AUTH_POST]', error)
    return NextResponse.json(
      { error: 'Login failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
