import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuid } from 'uuid'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission, checkModuleEnabled } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'
import { analyzeMedicalImage } from '@/lib/ai-service'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 10 * 1024 * 1024

const analyzeImageSchema = z.object({
  modality: z.string().min(1, 'Modality is required'),
  bodyPart: z.string().optional(),
  clinicalContext: z.string().optional(),
  patientId: z.string().optional(),
  visitId: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/ai')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  const moduleCheck = await checkModuleEnabled('ai-imaging')
  if (!moduleCheck.allowed) return NextResponse.json({ error: moduleCheck.error!.message }, { status: 403 })

  try {
    const formData = await request.formData()
    const file = formData.get('image') as File | null
    const metadataRaw = formData.get('metadata') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: `File too large. Maximum size: ${MAX_SIZE / 1024 / 1024}MB` }, { status: 400 })
    }

    let metadata = {}
    if (metadataRaw) {
      const parsed = analyzeImageSchema.safeParse(JSON.parse(metadataRaw))
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        )
      }
      metadata = parsed.data
    }

    const mod = metadata as z.infer<typeof analyzeImageSchema>
    const modality = mod.modality || 'X-Ray'
    const bodyPart = mod.bodyPart
    const clinicalContext = mod.clinicalContext
    const patientId = mod.patientId ?? undefined
    const visitId = mod.visitId ?? undefined

    // Save the image
    const ext = file.name.split('.').pop() || 'png'
    const filename = `ai-imaging-${uuid()}.${ext}`
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'ai-imaging')
    await mkdir(uploadDir, { recursive: true })

    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(join(uploadDir, filename), buffer)
    const imageUrl = `/uploads/ai-imaging/${filename}`

    // Run AI analysis (Gemini + Claude in parallel)
    const analysis = await analyzeMedicalImage(buffer, file.type, modality, { bodyPart, clinicalContext })

    // Generate unique ID
    const count = await db.aiAnalysis.count()
    const analysisId = `AI-IMG-${String(count + 1).padStart(4, '0')}`

    // Store in database
    const stored = await db.aiAnalysis.create({
      data: {
        analysisId,
        patientId: patientId ?? null,
        visitId: visitId ?? null,
        type: `${modality} Analysis`,
        model: 'Gemini + Claude',
        input: JSON.stringify({
          imageUrl,
          modality,
          bodyPart,
          clinicalContext,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        }),
        result: JSON.stringify({
          gemini: analysis.gemini.result,
          claude: analysis.claude.result,
          geminiError: analysis.gemini.error || null,
          claudeError: analysis.claude.error || null,
        }),
        requestedById: auth.user!.id,
      },
    })

    // Log audit
    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'ai-analysis',
      details: {
        analysisId: stored.analysisId,
        type: `${modality} Analysis`,
        modality,
        bodyPart,
        imageUrl,
        patientId,
        geminiStatus: analysis.gemini.error ? 'error' : 'completed',
        claudeStatus: analysis.claude.error ? 'error' : 'completed',
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({
      data: {
        id: stored.id,
        analysisId: stored.analysisId,
        type: stored.type,
        imageUrl,
        modality,
        bodyPart,
        clinicalContext,
        gemini: analysis.gemini.result,
        claude: analysis.claude.result,
        geminiError: analysis.gemini.error || null,
        claudeError: analysis.claude.error || null,
        createdAt: stored.createdAt,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('[AI_IMAGE_ANALYZE_POST]', error)
    return NextResponse.json(
      { error: 'Failed to analyze medical image', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/ai')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  const moduleCheck = await checkModuleEnabled('ai-imaging')
  if (!moduleCheck.allowed) return NextResponse.json({ error: moduleCheck.error!.message }, { status: 403 })

  try {
    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patientId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {
      type: { contains: 'Analysis' },
    }
    if (patientId) where.patientId = patientId

    const [items, total] = await Promise.all([
      db.aiAnalysis.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          analysisId: true,
          type: true,
          input: true,
          result: true,
          model: true,
          requestedById: true,
          createdAt: true,
        },
      }),
      db.aiAnalysis.count({ where }),
    ])

    const parsed = items.map((item) => ({
      ...item,
      input: JSON.parse(item.input),
      result: JSON.parse(item.result),
    }))

    return NextResponse.json({
      data: parsed,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('[AI_IMAGE_ANALYZE_LIST]', error)
    return NextResponse.json(
      { error: 'Failed to fetch analyses', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
