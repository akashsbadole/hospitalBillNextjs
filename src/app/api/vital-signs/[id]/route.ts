import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/vital-signs')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    const vitalSigns = await db.vitalSigns.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, patientId: true, name: true } },
        visit: { select: { id: true, visitId: true, visitType: true } },
      },
    })

    if (!vitalSigns) {
      return NextResponse.json({ error: 'Vital signs record not found' }, { status: 404 })
    }

    return NextResponse.json({ data: vitalSigns })
  } catch (error) {
    console.error('[VITAL_SIGNS_ID_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch vital signs', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/vital-signs')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'DELETE')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    const existing = await db.vitalSigns.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Vital signs record not found' }, { status: 404 })
    }

    await db.vitalSigns.delete({ where: { id } })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'DELETE',
      module: 'patients',
      details: { vitalSignsId: id, patientId: existing.patientId },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: { message: 'Vital signs record deleted' } })
  } catch (error) {
    console.error('[VITAL_SIGNS_ID_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete vital signs', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
