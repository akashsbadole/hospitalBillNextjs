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
    const department = await db.department.create({
      data: {
        name: body.name,
        description: body.description || null,
        code: body.code || null,
        sortOrder: body.sortOrder || 0,
      },
    })
    return NextResponse.json({ data: department }, { status: 201 })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'A department with this name or code already exists' }, { status: 409 })
    }
    console.error('[DEPARTMENTS_POST]', error)
    return NextResponse.json({ error: 'Failed to create department' }, { status: 500 })
  }
}
