import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  config: z.any().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request, '/api/analytics')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    const dashboard = await db.analyticsDashboard.findUnique({
      where: { id },
      include: {
        widgets: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    if (!dashboard) return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 })
    return NextResponse.json({ data: dashboard })
  } catch (error) {
    console.error('[DASHBOARD_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request, '/api/analytics')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data: Record<string, unknown> = { ...parsed.data }
    if (data.config !== undefined) {
      data.config = data.config ? JSON.stringify(data.config) : null
    }

    if (data.isDefault === true) {
      await db.analyticsDashboard.updateMany({
        where: { id: { not: id }, isDefault: true },
        data: { isDefault: false },
      })
    }

    const existing = await db.analyticsDashboard.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 })

    const dashboard = await db.analyticsDashboard.update({ where: { id }, data })
    return NextResponse.json({ data: dashboard })
  } catch (error) {
    console.error('[DASHBOARD_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update dashboard', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request, '/api/analytics')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'DELETE')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    const existing = await db.analyticsDashboard.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 })

    await db.analyticsDashboard.delete({ where: { id } })
    return NextResponse.json({ data: { id }, message: 'Dashboard deleted successfully' })
  } catch (error) {
    console.error('[DASHBOARD_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete dashboard', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
