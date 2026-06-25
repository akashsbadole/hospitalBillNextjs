import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    const modules = await db.moduleSetting.findMany({
      where: { enabled: true },
      select: { moduleKey: true, label: true, section: true, icon: true },
      orderBy: [{ section: 'asc' }, { label: 'asc' }],
    })

    return NextResponse.json({ data: modules })
  } catch (error) {
    console.error('[MODULES_ENABLED_GET]', error)
    return NextResponse.json({ data: [] })
  }
}
