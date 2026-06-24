import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  // Authenticate — only Admin can view audit logs
  const auth = await authenticateRequest(request, '/api/settings')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  // Check if Admin
  if (auth.role !== 'Admin') {
    return NextResponse.json({ error: 'Access denied. Only Admin can view audit logs.' }, { status: 403 })
  }

  try {
    const { searchParams } = request.nextUrl
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
    const skip = (page - 1) * limit

    const action = searchParams.get('action')
    const module_ = searchParams.get('module')
    const userId = searchParams.get('userId')
    const search = searchParams.get('search')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    const validActions = ['LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'VIEW', 'EXPORT', 'STATUS_CHANGE']
    if (action && !validActions.includes(action)) {
      return NextResponse.json({ error: 'Invalid action filter' }, { status: 400 })
    }

    const validModules = ['patients', 'appointments', 'doctors', 'billing', 'payments', 'prescriptions', 'medicines', 'settings', 'reports', 'support', 'auth', 'users', 'staff']
    if (module_ && !validModules.includes(module_)) {
      return NextResponse.json({ error: 'Invalid module filter' }, { status: 400 })
    }

    const where: Record<string, unknown> = {}
    if (action) where.action = action
    if (module_) where.module = module_
    if (userId) where.userId = userId
    if (fromDate || toDate) {
      const dateFilter: Record<string, unknown> = {}
      if (fromDate) dateFilter.gte = fromDate
      if (toDate) dateFilter.lte = toDate + 'T23:59:59.999Z'
      where.createdAt = dateFilter
    }
    if (search) {
      where.OR = [
        { userName: { contains: search } },
        { userEmail: { contains: search } },
        { details: { contains: search } },
        { action: { contains: search } },
        { module: { contains: search } },
      ]
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.auditLog.count({ where }),
    ])

    return NextResponse.json({
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[AUDIT_LOGS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit logs', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
