import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── GET ──────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/ai')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const patientId = searchParams.get('patientId')
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const type = searchParams.get('type')

    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 })
    }

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { patientId }
    if (type) where.type = type

    const [analyses, total] = await Promise.all([
      db.aiAnalysis.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: {
            select: { name: true, patientId: true },
          },
        },
      }),
      db.aiAnalysis.count({ where }),
    ])

    // Parse JSON fields for each analysis
    const parsedAnalyses = analyses.map(analysis => ({
      id: analysis.id,
      analysisId: analysis.analysisId,
      type: analysis.type,
      input: (() => { try { return JSON.parse(analysis.input) } catch { return analysis.input } })(),
      result: (() => { try { return JSON.parse(analysis.result) } catch { return analysis.result } })(),
      model: analysis.model,
      patientName: analysis.patient.name,
      createdAt: analysis.createdAt,
    }))

    // Log audit
    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'VIEW',
      module: 'ai-analysis',
      details: { patientId, page, limit },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({
      data: parsedAnalyses,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[AI_HISTORY_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch AI analysis history', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
