import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'
import { VISIT_STAGES } from '../../route'

// ── Schemas ──────────────────────────────────────────────────────────────
const labTestSchema = z.object({
  testName: z.string().trim().min(1, 'Test name is required'),
  testCode: z.string().trim().optional(),
  category: z.string().trim().optional().default('General'),
})

const createLabOrderSchema = z.object({
  tests: z.array(labTestSchema).min(1, 'At least one test is required').max(50),
})

// ── GET: Retrieve lab orders for a visit ────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/patient-visits')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    const { id } = await params

    const visit = await db.patientVisit.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, patientId: true, name: true } },
        stages: { orderBy: { createdAt: 'asc' } },
      },
    })

    if (!visit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 })
    }

    // Lab orders are stored in the Lab-Ordered stage notes as JSON
    const labOrderedStage = visit.stages.find(s => s.stage === 'Lab-Ordered')
    let labOrders: Array<{ testName: string; testCode?: string; category: string }> = []

    if (labOrderedStage?.notes) {
      try {
        const parsed = JSON.parse(labOrderedStage.notes)
        if (Array.isArray(parsed)) {
          labOrders = parsed
        }
      } catch {
        // notes might not be JSON
      }
    }

    return NextResponse.json({
      data: {
        visitId: visit.visitId,
        patientId: visit.patient.patientId,
        patientName: visit.patient.name,
        orderedAt: labOrderedStage?.completedAt?.toISOString() ?? null,
        tests: labOrders,
      },
    })
  } catch (error) {
    console.error('[LAB_ORDERS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch lab orders', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── POST: Create lab orders when advancing to Lab-Ordered stage ─────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request, '/api/patient-visits')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const { id } = await params
    const body = await request.json()

    const parsed = createLabOrderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { tests } = parsed.data

    // Fetch visit with stages
    const visit = await db.patientVisit.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, patientId: true, name: true, phone: true } },
        stages: { orderBy: { createdAt: 'asc' } },
      },
    })

    if (!visit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 })
    }

    if (visit.status !== 'Active') {
      return NextResponse.json(
        { error: `Visit is ${visit.status.toLowerCase()}. Only active visits can have lab orders.` },
        { status: 400 }
      )
    }

    // Helper: get stage index
    function stageIndex(stage: string): number {
      return VISIT_STAGES.indexOf(stage as typeof VISIT_STAGES[number])
    }

    const currentIdx = stageIndex(visit.stage)
    const labOrderedIdx = stageIndex('Lab-Ordered')
    const labDoneIdx = stageIndex('Lab-Done')

    // Visit must be before or at Lab-Ordered stage
    if (currentIdx > labDoneIdx) {
      return NextResponse.json(
        { error: 'Lab work already completed', details: `Visit is already at "${visit.stage}" stage` },
        { status: 400 }
      )
    }

    // Transaction: update lab orders in stage notes + advance stage
    const result = await db.$transaction(async (tx) => {
      // Find or create the Lab-Ordered stage record and store lab tests as JSON in notes
      const labStageRecord = visit.stages.find(s => s.stage === 'Lab-Ordered')

      if (labStageRecord) {
        // Merge with existing tests or replace
        await tx.visitStage.update({
          where: { id: labStageRecord.id },
          data: {
            status: 'Completed',
            completedAt: new Date(),
            completedById: auth.user!.id,
            notes: JSON.stringify(tests),
          },
        })
      }

      // Mark current active stage as Completed
      const currentStageRecord = visit.stages.find(s => s.stage === visit.stage && s.status === 'Active')
      if (currentStageRecord && currentStageRecord.id !== labStageRecord?.id) {
        await tx.visitStage.update({
          where: { id: currentStageRecord.id },
          data: {
            status: 'Completed',
            completedAt: new Date(),
            completedById: auth.user!.id,
            notes: `Lab tests ordered: ${tests.map(t => t.testName).join(', ')}`,
          },
        })
      }

      // Skip intermediate stages between current and Lab-Ordered
      for (let i = currentIdx + 1; i < labOrderedIdx; i++) {
        const skipStageRecord = visit.stages.find(s => s.stage === VISIT_STAGES[i] && s.status === 'Pending')
        if (skipStageRecord) {
          await tx.visitStage.update({
            where: { id: skipStageRecord.id },
            data: { status: 'Skipped' },
          })
        }
      }

      // Also skip Lab-Done if we're only ordering (it will be marked done later)
      // Update visit stage to Lab-Done (since we're ordering + assuming immediate)
      // Actually, advance to Lab-Done only if current is before Lab-Ordered
      let targetStage = 'Lab-Ordered'
      if (currentIdx >= labOrderedIdx) {
        targetStage = 'Lab-Done'
      }

      const targetIdx = stageIndex(targetStage)

      // Skip stages between labOrderedIdx and targetIdx
      for (let i = labOrderedIdx + 1; i < targetIdx; i++) {
        const skipRecord = visit.stages.find(s => s.stage === VISIT_STAGES[i] && s.status === 'Pending')
        if (skipRecord) {
          await tx.visitStage.update({
            where: { id: skipRecord.id },
            data: { status: 'Skipped' },
          })
        }
      }

      // If advancing to Lab-Done, mark it as Active
      if (targetStage === 'Lab-Done') {
        const labDoneRecord = visit.stages.find(s => s.stage === 'Lab-Done' && s.status === 'Pending')
        if (labDoneRecord) {
          await tx.visitStage.update({
            where: { id: labDoneRecord.id },
            data: { status: 'Active' },
          })
        }
      }

      const updatedVisit = await tx.patientVisit.update({
        where: { id },
        data: { stage: targetStage },
        include: {
          patient: { select: { id: true, patientId: true, name: true, phone: true } },
          stages: { orderBy: { createdAt: 'asc' } },
          _count: { select: { analyses: true } },
        },
      })

      return updatedVisit
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'patient-visits',
      details: {
        visitId: visit.visitId,
        patientId: visit.patient.patientId,
        patientName: visit.patient.name,
        fromStage: visit.stage,
        toStage: result.stage,
        labTests: tests.map(t => t.testName),
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({
      data: {
        visit: result,
        testsOrdered: tests.length,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('[LAB_ORDERS_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create lab orders', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
