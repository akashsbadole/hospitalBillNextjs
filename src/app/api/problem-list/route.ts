import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'
import { z } from 'zod'

const createSchema = z.object({
  patientId: z.string().min(1),
  problem: z.string().min(1, 'Problem description is required'),
  icdCode: z.string().optional(),
  status: z.enum(['Active', 'Resolved', 'Inactive']).default('Active'),
  onsetDate: z.string().optional(),
  notes: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/problem-list')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const patientId = searchParams.get('patientId')
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (patientId) where.patientId = patientId
    if (status && status !== 'all') where.status = status

    const problems = await db.problemList.findMany({
      where,
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    })
    return NextResponse.json({ data: problems })
  } catch (error) {
    console.error('[PROBLEM_LIST_GET]', error)
    return NextResponse.json({ error: 'Failed to fetch problem list' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/problem-list')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const body = await request.json()
    const data = createSchema.parse(body)
    const problem = await db.problemList.create({
      data: { ...data, createdById: auth.userId! },
    })
    return NextResponse.json({ data: problem }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.flatten() }, { status: 400 })
    }
    console.error('[PROBLEM_LIST_POST]', error)
    return NextResponse.json({ error: 'Failed to create problem' }, { status: 500 })
  }
}
