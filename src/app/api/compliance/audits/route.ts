import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generateComplianceAuditId } from '@/lib/utils'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'

const createAuditSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  auditDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Audit date must be YYYY-MM-DD'),
  auditor: z.string().optional(),
  department: z.string().optional(),
  strengths: z.string().optional(),
  improvements: z.string().optional(),
  findings: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/settings')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const status = searchParams.get('status')
    const department = searchParams.get('department')

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (department) where.department = department

    const [audits, total] = await Promise.all([
      db.complianceAudit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.complianceAudit.count({ where }),
    ])

    return NextResponse.json({ data: audits, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('[COMPLIANCE_AUDITS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch compliance audits', details: error instanceof Error ? error.message : 'Unknown error' },
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
    const parsed = createAuditSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const lastAudit = await db.complianceAudit.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { auditId: true },
    })
    const auditId = generateComplianceAuditId(lastAudit?.auditId ?? null)

    const audit = await db.complianceAudit.create({
      data: {
        auditId,
        title: data.title,
        auditDate: data.auditDate,
        auditor: data.auditor ?? null,
        department: data.department ?? null,
        strengths: data.strengths ?? null,
        improvements: data.improvements ?? null,
        findings: data.findings ?? null,
      },
    })

    return NextResponse.json({ data: audit }, { status: 201 })
  } catch (error) {
    console.error('[COMPLIANCE_AUDITS_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create compliance audit', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
