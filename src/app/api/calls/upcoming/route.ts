import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'

// ── GET — Upcoming calls for a doctor or patient ────────────────────────
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/calls')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const doctorId = searchParams.get('doctorId')
    const patientId = searchParams.get('patientId')
    const rawLimit = searchParams.get('limit')

    if (!doctorId && !patientId) {
      return NextResponse.json(
        { error: 'Either doctorId or patientId is required' },
        { status: 400 }
      )
    }

    const limit = isNaN(Number(rawLimit)) ? 10 : Math.min(50, Math.max(1, parseInt(rawLimit || '10', 10)))

    const now = new Date().toISOString()

    const where: Record<string, unknown> = {
      status: 'Scheduled',
      scheduledAt: { gte: now },
    }
    if (doctorId) where.doctorId = doctorId
    if (patientId) where.patientId = patientId

    const calls = await db.callSession.findMany({
      where,
      take: limit,
      orderBy: { scheduledAt: 'asc' },
      include: {
        patient: { select: { id: true, patientId: true, name: true, phone: true } },
        doctor: { select: { id: true, doctorId: true, name: true, specialization: true } },
        visit: { select: { id: true, visitId: true } },
      },
    })

    return NextResponse.json({ data: calls })
  } catch (error) {
    console.error('[CALLS_UPCOMING_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch upcoming calls', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
