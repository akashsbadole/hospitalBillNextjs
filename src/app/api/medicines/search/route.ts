import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/medicines')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const q = searchParams.get('q')?.trim() || ''

    if (q.length < 2) {
      return NextResponse.json(
        { error: 'Search query must be at least 2 characters' },
        { status: 400 }
      )
    }

    const medicines = await db.medicine.findMany({
      where: {
        status: 'Active',
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { manufacturer: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: { name: 'asc' },
      take: 20,
      select: {
        id: true,
        medicineId: true,
        name: true,
        category: true,
        manufacturer: true,
        sellingPrice: true,
        stock: true,
        status: true,
      },
    })

    return NextResponse.json({ data: medicines })
  } catch (error) {
    console.error('[MEDICINES_SEARCH_GET]', error)
    return NextResponse.json(
      { error: 'Failed to search medicines', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
