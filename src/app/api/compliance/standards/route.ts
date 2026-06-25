import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generateComplianceStandardId } from '@/lib/utils'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'

const createStandardSchema = z.object({
  authority: z.string().trim().min(1, 'Authority is required'),
  chapter: z.string().trim().min(1, 'Chapter is required'),
  code: z.string().trim().min(1, 'Code is required'),
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().optional(),
  isMandatory: z.boolean().default(true),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/settings')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { searchParams } = request.nextUrl
    const authority = searchParams.get('authority')
    const chapter = searchParams.get('chapter')

    const where: Record<string, unknown> = {}
    if (authority) where.authority = authority
    if (chapter) where.chapter = chapter

    const standards = await db.complianceStandard.findMany({
      where,
      orderBy: [{ authority: 'asc' }, { code: 'asc' }],
    })

    return NextResponse.json({ data: standards })
  } catch (error) {
    console.error('[COMPLIANCE_STANDARDS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch compliance standards', details: error instanceof Error ? error.message : 'Unknown error' },
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
    const parsed = createStandardSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const lastStandard = await db.complianceStandard.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { standardId: true },
    })
    const standardId = generateComplianceStandardId(lastStandard?.standardId ?? null)

    const standard = await db.complianceStandard.create({
      data: {
        standardId,
        authority: data.authority,
        chapter: data.chapter,
        code: data.code,
        title: data.title,
        description: data.description ?? null,
        isMandatory: data.isMandatory,
      },
    })

    return NextResponse.json({ data: standard }, { status: 201 })
  } catch (error) {
    console.error('[COMPLIANCE_STANDARDS_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create compliance standard', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
