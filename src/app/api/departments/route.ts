import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/departments')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const departments = await db.department.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
    return NextResponse.json({ data: departments })
  } catch (error) {
    console.error('[DEPARTMENTS_GET]', error)
    return NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/departments')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const body = await request.json()

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return NextResponse.json({ error: 'Department name is required' }, { status: 400 })
    }

    const department = await db.department.create({
      data: {
        name: body.name.trim().slice(0, 100),
        description: typeof body.description === 'string' ? body.description.trim().slice(0, 500) : null,
        code: typeof body.code === 'string' ? body.code.trim().slice(0, 20) : null,
        sortOrder: typeof body.sortOrder === 'number' ? Math.max(0, Math.floor(body.sortOrder)) : 0,
      },
    })
    return NextResponse.json({ data: department }, { status: 201 })
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ error: 'A department with this name or code already exists' }, { status: 409 })
    }
    console.error('[DEPARTMENTS_POST]', error)
    return NextResponse.json({ error: 'Failed to create department' }, { status: 500 })
  }
}
