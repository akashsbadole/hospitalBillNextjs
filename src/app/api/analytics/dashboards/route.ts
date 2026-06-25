import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  config: z.any().optional(),
  isDefault: z.boolean().optional(),
  createdBy: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/analytics')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const dashboards = await db.analyticsDashboard.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        widgets: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    return NextResponse.json({ data: dashboards })
  } catch (error) {
    console.error('[DASHBOARDS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboards', details: error instanceof Error ? error.message : 'Unknown error' },
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

    if (data.isDefault) {
      await db.analyticsDashboard.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      })
    }

    const dashboard = await db.analyticsDashboard.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        config: data.config ? JSON.stringify(data.config) : null,
        isDefault: data.isDefault ?? false,
        createdBy: data.createdBy ?? auth.userId,
      },
    })

    return NextResponse.json({ data: dashboard }, { status: 201 })
  } catch (error) {
    console.error('[DASHBOARDS_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create dashboard', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
