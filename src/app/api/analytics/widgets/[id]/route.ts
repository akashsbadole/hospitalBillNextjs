import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  type: z.string().optional(),
  dataSource: z.string().optional(),
  queryConfig: z.any().optional(),
  chartConfig: z.any().optional(),
  position: z.any().optional(),
  isActive: z.boolean().optional(),
})

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
    if (data.queryConfig !== undefined) {
      data.queryConfig = data.queryConfig ? JSON.stringify(data.queryConfig) : null
    }
    if (data.chartConfig !== undefined) {
      data.chartConfig = data.chartConfig ? JSON.stringify(data.chartConfig) : null
    }
    if (data.position !== undefined) {
      data.position = data.position ? JSON.stringify(data.position) : null
    }

    const existing = await db.analyticsWidget.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Widget not found' }, { status: 404 })

    const widget = await db.analyticsWidget.update({ where: { id }, data })
    return NextResponse.json({ data: widget })
  } catch (error) {
    console.error('[WIDGET_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update widget', details: error instanceof Error ? error.message : 'Unknown error' },
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
    const existing = await db.analyticsWidget.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Widget not found' }, { status: 404 })

    await db.analyticsWidget.delete({ where: { id } })
    return NextResponse.json({ data: { id }, message: 'Widget deleted successfully' })
  } catch (error) {
    console.error('[WIDGET_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete widget', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
