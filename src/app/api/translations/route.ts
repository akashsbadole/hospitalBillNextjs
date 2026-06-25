import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'

const upsertTranslationSchema = z.object({
  locale: z.string().trim().min(1, 'Locale is required'),
  namespace: z.string().trim().min(1, 'Namespace is required'),
  key: z.string().trim().min(1, 'Key is required'),
  value: z.string().trim().min(1, 'Value is required'),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/settings')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    const { searchParams } = request.nextUrl
    const locale = searchParams.get('locale')
    const namespace = searchParams.get('namespace')

    if (!locale) {
      return NextResponse.json({ error: 'Locale query parameter is required' }, { status: 400 })
    }

    const where: Record<string, unknown> = { locale }
    if (namespace) where.namespace = namespace

    const translations = await db.translation.findMany({ where })

    // Return as key-value map for easy consumption
    const result: Record<string, string> = {}
    for (const t of translations) {
      const key = namespace ? `${t.namespace}.${t.key}` : t.key
      result[key] = t.value
    }

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('[TRANSLATIONS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch translations', details: error instanceof Error ? error.message : 'Unknown error' },
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
    const parsed = upsertTranslationSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const translation = await db.translation.upsert({
      where: {
        locale_namespace_key: {
          locale: data.locale,
          namespace: data.namespace,
          key: data.key,
        },
      },
      update: { value: data.value },
      create: {
        locale: data.locale,
        namespace: data.namespace,
        key: data.key,
        value: data.value,
      },
    })

    return NextResponse.json({ data: translation }, { status: 201 })
  } catch (error) {
    console.error('[TRANSLATIONS_POST]', error)
    return NextResponse.json(
      { error: 'Failed to upsert translation', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
