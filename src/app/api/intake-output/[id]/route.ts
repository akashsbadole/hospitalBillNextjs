import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/intake-output')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'DELETE')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    const existing = await db.intakeOutput.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Intake/output record not found' }, { status: 404 })
    }

    await db.intakeOutput.delete({ where: { id } })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'DELETE',
      module: 'patients',
      details: { intakeOutputId: id, patientId: existing.patientId },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: { message: 'Intake/output record deleted' } })
  } catch (error) {
    console.error('[INTAKE_OUTPUT_ID_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete intake/output record', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
