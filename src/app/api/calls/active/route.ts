import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'

// ── GET — Currently active (in-progress) calls ─────────────────────────
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/calls')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const doctorId = searchParams.get('doctorId')

    const where: Record<string, unknown> = {
      status: 'In-Progress',
    }
    if (doctorId) where.doctorId = doctorId

    const calls = await db.callSession.findMany({
      where,
      orderBy: { startedAt: 'asc' },
      include: {
        patient: { select: { id: true, patientId: true, name: true, phone: true } },
        doctor: { select: { id: true, doctorId: true, name: true, specialization: true } },
        visit: { select: { id: true, visitId: true } },
      },
    })

    return NextResponse.json({ data: calls })
  } catch (error) {
    console.error('[CALLS_ACTIVE_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch active calls', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
