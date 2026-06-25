import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

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
      select: {
        id: true,
        analysisId: true,
        patientId: true,
        visitId: true,
        type: true,
        input: true,
        result: true,
        model: true,
        requestedById: true,
        createdAt: true,
      },
    })

    if (!analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
    }

    return NextResponse.json({
      data: {
        ...analysis,
        input: JSON.parse(analysis.input),
        result: JSON.parse(analysis.result),
      },
    })
  } catch (error) {
    console.error('[AI_IMAGE_ANALYZE_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch analysis', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/ai')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'DELETE')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    const analysis = await db.aiAnalysis.findUnique({ where: { id } })
    if (!analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
    }

    await db.aiAnalysis.delete({ where: { id } })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'DELETE',
      module: 'ai-analysis',
      details: { analysisId: analysis.analysisId, type: analysis.type },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: { success: true } })
  } catch (error) {
    console.error('[AI_IMAGE_ANALYZE_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete analysis', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
