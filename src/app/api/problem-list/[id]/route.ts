import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'
import { z } from 'zod'

const updateSchema = z.object({
  problem: z.string().optional(),
  icdCode: z.string().nullable().optional(),
  status: z.enum(['Active', 'Resolved', 'Inactive']).optional(),
  onsetDate: z.string().nullable().optional(),
  resolvedDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request, '/api/problem-list')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    const body = await request.json()
    const data = updateSchema.parse(body)
    const problem = await db.problemList.update({ where: { id }, data })
    return NextResponse.json({ data: problem })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.flatten() }, { status: 400 })
    }
    console.error('[PROBLEM_PUT]', error)
    return NextResponse.json({ error: 'Failed to update problem' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request, '/api/problem-list')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    await db.problemList.delete({ where: { id } })
    return NextResponse.json({ message: 'Problem deleted' })
  } catch (error) {
    console.error('[PROBLEM_DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete problem' }, { status: 500 })
  }
}
