import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'
import { createImagingStudySchema } from '@/lib/validations'
import { generateImagingStudyId } from '@/lib/utils'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/imaging')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get('page')
    const rawLimit = searchParams.get('limit')
    const modality = searchParams.get('modality')
    const status = searchParams.get('status')
    const patientId = searchParams.get('patientId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const page = isNaN(Number(rawPage)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10))
    const limit = isNaN(Number(rawLimit)) ? 20 : Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)))
    const skip = (page - 1) * limit

    const validStatuses = ['Ordered', 'Scheduled', 'In-Progress', 'Completed', 'Reviewed', 'Reported']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status filter', details: `Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const validModalities = ['X-Ray', 'MRI', 'CT', 'Ultrasound', 'Mammography', 'PET', 'DEXA', 'Fluoroscopy']
    if (modality && !validModalities.includes(modality)) {
      return NextResponse.json(
        { error: 'Invalid modality filter', details: `Must be one of: ${validModalities.join(', ')}` },
        { status: 400 }
      )
    }

    const where: Record<string, unknown> = {}
    if (modality) where.modality = modality
    if (status) where.status = status
    if (patientId) where.patientId = patientId
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {}
      if (dateFrom) dateFilter.gte = new Date(dateFrom)
      if (dateTo) dateFilter.lte = new Date(dateTo)
      where.orderedAt = dateFilter
    }

    const [studies, total] = await Promise.all([
      db.imagingStudy.findMany({
        where,
        orderBy: { orderedAt: 'desc' },
        skip,
        take: limit,
        include: {
          patient: { select: { id: true, patientId: true, name: true, phone: true, gender: true } },
          doctor: { select: { id: true, doctorId: true, name: true, specialization: true } },
          visit: { select: { id: true, visitId: true, visitType: true, department: true } },
        },
      }),
      db.imagingStudy.count({ where }),
    ])

    return NextResponse.json({
      data: studies,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[IMAGING_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch imaging studies', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/imaging')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const body = await request.json()
    const parsed = createImagingStudySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const patient = await db.patient.findUnique({ where: { id: data.patientId } })
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    if (data.doctorId) {
      const doctor = await db.doctor.findUnique({ where: { id: data.doctorId } })
      if (!doctor) {
        return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
      }
    }

    if (data.visitId) {
      const visit = await db.patientVisit.findUnique({ where: { id: data.visitId } })
      if (!visit) {
        return NextResponse.json({ error: 'Visit not found' }, { status: 404 })
      }
    }

    const lastStudy = await db.imagingStudy.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { studyId: true },
    })
    const studyId = generateImagingStudyId(lastStudy?.studyId ?? null)

    const study = await db.imagingStudy.create({
      data: {
        ...data,
        studyId,
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'imaging',
      details: { studyId: study.studyId, patientId: data.patientId, modality: data.modality, bodyPart: data.bodyPart },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({ data: study }, { status: 201 })
  } catch (error) {
    console.error('[IMAGING_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create imaging study', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
