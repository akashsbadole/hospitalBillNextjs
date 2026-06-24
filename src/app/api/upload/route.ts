import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuid } from 'uuid'
import { authenticateRequest } from '@/lib/api-auth'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/upload')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const type = (formData.get('type') as string) || 'general'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size: 5MB' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() || 'png'
    const filename = `${uuid()}.${ext}`
    const uploadDir = join(process.cwd(), 'public', 'uploads', type)
    await mkdir(uploadDir, { recursive: true })

    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(join(uploadDir, filename), buffer)

    const url = `/uploads/${type}/${filename}`

    return NextResponse.json({ data: { url, filename } })
  } catch (error) {
    console.error('[UPLOAD]', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
