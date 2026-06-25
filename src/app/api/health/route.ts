import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const start = Date.now()
    await db.$queryRaw`SELECT 1`
    const dbLatency = Date.now() - start

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      db: {
        connected: true,
        latencyMs: dbLatency,
      },
      memory: process.memoryUsage(),
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      db: {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown database error',
      },
    }, { status: 503 })
  }
}
