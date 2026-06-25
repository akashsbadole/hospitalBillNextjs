import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'

const createSchema = z.object({
  dashboardId: z.string().min(1, 'Dashboard is required'),
  title: z.string().min(1, 'Title is required'),
  type: z.string().min(1, 'Type is required'),
  dataSource: z.string().min(1, 'Data source is required'),
  queryConfig: z.any().optional(),
  chartConfig: z.any().optional(),
  position: z.any().optional(),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/analytics')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const dashboardId = searchParams.get('dashboardId')

    const where: Record<string, unknown> = { isActive: true }
    if (dashboardId) where.dashboardId = dashboardId

    const widgets = await db.analyticsWidget.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ data: widgets })
  } catch (error) {
    console.error('[WIDGETS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch widgets', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/analytics')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const dashboard = await db.analyticsDashboard.findUnique({ where: { id: data.dashboardId } })
    if (!dashboard) return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 })

    const lastWidget = await db.analyticsWidget.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { widgetId: true },
    })
    const widgetId = lastWidget
      ? `WID-${String(parseInt(lastWidget.widgetId.replace('WID-', ''), 10) + 1).padStart(4, '0')}`
      : 'WID-0001'

    const widget = await db.analyticsWidget.create({
      data: {
        widgetId,
        dashboardId: data.dashboardId,
        title: data.title,
        type: data.type,
        dataSource: data.dataSource,
        queryConfig: data.queryConfig ? JSON.stringify(data.queryConfig) : null,
        chartConfig: data.chartConfig ? JSON.stringify(data.chartConfig) : null,
        position: data.position ? JSON.stringify(data.position) : null,
      },
    })

    return NextResponse.json({ data: widget }, { status: 201 })
  } catch (error) {
    console.error('[WIDGETS_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create widget', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
