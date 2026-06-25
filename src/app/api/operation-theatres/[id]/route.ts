import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request, '/api/operation-theatres', )
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    const body = await request.json()
    const theatre = await db.operationTheatre.update({ where: { id }, data: body })
    return NextResponse.json({ data: theatre })
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Operation theatre not found' }, { status: 404 })
    }
    console.error('[OT_PUT]', error)
    return NextResponse.json({ error: 'Failed to update operation theatre' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request, '/api/operation-theatres', )
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    await db.operationTheatre.delete({ where: { id } })
    return NextResponse.json({ message: 'Operation theatre deleted' })
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Operation theatre not found' }, { status: 404 })
    }
    console.error('[OT_DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete operation theatre' }, { status: 500 })
  }
}
