import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/modules')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const modules = await db.moduleSetting.findMany({
      orderBy: [{ section: 'asc' }, { label: 'asc' }],
    })

    return NextResponse.json({ data: modules })
  } catch (error) {
    console.error('[MODULES_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch modules', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/modules')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  if (auth.role !== 'Super Admin') {
    return NextResponse.json({ error: 'Only Super Admin can manage modules' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { id, enabled } = body

    if (!id || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request: id and enabled are required' }, { status: 400 })
    }

    const mod = await db.moduleSetting.findUnique({ where: { id } })
    if (!mod) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 })
    }
    if (mod.isCore) {
      return NextResponse.json({ error: `"${mod.label}" is a core module and cannot be disabled` }, { status: 400 })
    }

    const updated = await db.moduleSetting.update({
      where: { id },
      data: { enabled, updatedById: auth.user!.id },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'UPDATE',
      module: 'settings',
      details: {
        moduleKey: updated.moduleKey,
        label: updated.label,
        enabled: updated.enabled,
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[MODULES_PATCH]', error)
    return NextResponse.json(
      { error: 'Failed to update module', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
