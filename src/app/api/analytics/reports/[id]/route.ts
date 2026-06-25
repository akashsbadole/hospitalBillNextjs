import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request, '/api/analytics')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params
    const report = await db.analyticsReport.findUnique({ where: { id } })
    if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    return NextResponse.json({ data: report })
  } catch (error) {
    console.error('[REPORT_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch report', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request, '/api/analytics')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'DELETE')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    const existing = await db.analyticsReport.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    await db.analyticsReport.delete({ where: { id } })
    return NextResponse.json({ data: { id }, message: 'Report deleted successfully' })
  } catch (error) {
    console.error('[REPORT_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete report', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
