import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generateComplianceChecklistId } from '@/lib/utils'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'

const createChecklistSchema = z.object({
  standardId: z.string().trim().min(1, 'Standard ID is required'),
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().optional(),
  targetDate: z.string().optional(),
  assignedToId: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/settings')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { searchParams } = request.nextUrl
    const standardId = searchParams.get('standardId')
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (standardId) where.standardId = standardId
    if (status) where.status = status

    const checklists = await db.complianceChecklist.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        standard: { select: { id: true, standardId: true, authority: true, chapter: true, code: true, title: true } },
      },
    })

    return NextResponse.json({ data: checklists })
  } catch (error) {
    console.error('[COMPLIANCE_CHECKLIST_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch compliance checklists', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/settings')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createChecklistSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const standard = await db.complianceStandard.findUnique({ where: { id: data.standardId } })
    if (!standard) {
      return NextResponse.json({ error: 'Compliance standard not found' }, { status: 404 })
    }

    const lastChecklist = await db.complianceChecklist.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { checklistId: true },
    })
    const checklistId = generateComplianceChecklistId(lastChecklist?.checklistId ?? null)

    const checklist = await db.complianceChecklist.create({
      data: {
        checklistId,
        standardId: data.standardId,
        title: data.title,
        description: data.description ?? null,
        targetDate: data.targetDate ?? null,
        assignedToId: data.assignedToId ?? null,
      },
      include: {
        standard: { select: { id: true, standardId: true, authority: true, code: true, title: true } },
      },
    })

    return NextResponse.json({ data: checklist }, { status: 201 })
  } catch (error) {
    console.error('[COMPLIANCE_CHECKLIST_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create compliance checklist', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
