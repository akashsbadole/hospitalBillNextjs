import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request, '/api/departments')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    const body = await request.json()
    const department = await db.department.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description ?? undefined,
        code: body.code ?? undefined,
        isActive: body.isActive,
        sortOrder: body.sortOrder,
      },
    })
    return NextResponse.json({ data: department })
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ error: 'A department with this name or code already exists' }, { status: 409 })
    }
    if ((error as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 })
    }
    console.error('[DEPARTMENTS_PUT]', error)
    return NextResponse.json({ error: 'Failed to update department' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request, '/api/departments')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    await db.department.delete({ where: { id } })
    return NextResponse.json({ message: 'Department deleted' })
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 })
    }
    console.error('[DEPARTMENTS_DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete department' }, { status: 500 })
  }
}
