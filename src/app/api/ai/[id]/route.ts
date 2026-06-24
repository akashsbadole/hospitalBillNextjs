import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

// ── GET ──────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/ai')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params

    const analysis = await db.aiAnalysis.findUnique({
      where: { id },
      include: {
        patient: {
          select: { name: true, patientId: true },
        },
      },
    })

    if (!analysis) {
      return NextResponse.json({ error: 'AI analysis not found' }, { status: 404 })
    }

    // Log audit
    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'VIEW',
      module: 'ai-analysis',
      details: {
        analysisId: analysis.analysisId,
        patientId: analysis.patientId,
        patientName: analysis.patient.name,
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({
      data: {
        id: analysis.id,
        analysisId: analysis.analysisId,
        type: analysis.type,
        input: (() => { try { return JSON.parse(analysis.input) } catch { return analysis.input } })(),
        result: (() => { try { return JSON.parse(analysis.result) } catch { return analysis.result } })(),
        model: analysis.model,
        patientName: analysis.patient.name,
        createdAt: analysis.createdAt,
      },
    })
  } catch (error) {
    console.error('[AI_ANALYSIS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch AI analysis', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
