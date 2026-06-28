import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'
import ZAI from 'z-ai-web-dev-sdk'

// ── Schemas ──────────────────────────────────────────────────────────────

const vitalsSchema = z.object({
  temperature: z.string().optional(),
  bloodPressure: z.string().optional(),
  pulse: z.string().optional(),
  oxygenLevel: z.string().optional(),
  weight: z.string().optional(),
  height: z.string().optional(),
}).optional()

const analyzeSchema = z.object({
  patientId: z.string().min(1, 'Patient ID is required'),
  visitId: z.string().optional(),
  type: z.enum(['Health Analysis', 'Symptom Check', 'Drug Interaction', 'Diagnosis Suggestion']).default('Health Analysis'),
  symptoms: z.string().min(1, 'Symptoms are required'),
  vitals: vitalsSchema,
  additionalContext: z.string().optional(),
})

// ── System Prompt ──────────────────────────────────────────────────────

const MEDICAL_SYSTEM_PROMPT = `You are an AI health analysis assistant for MediBill Pro hospital management system.
IMPORTANT: You are providing preliminary analysis only. Always include a disclaimer that this is not a substitute for professional medical advice.

Analyze the provided symptoms, vitals, and patient context. Provide:
1. Possible conditions (ranked by likelihood)
2. Recommended immediate actions
3. Suggested tests/investigations
4. Urgency level (Low, Medium, High, Emergency)
5. Follow-up recommendations

Format your response as structured JSON with the following shape:
{
  "summary": "Brief summary of the analysis",
  "disclaimer": "Medical disclaimer text",
  "possibleConditions": [
    { "name": "Condition name", "likelihood": "High/Medium/Low", "description": "Brief description", "reasoning": "Why this condition is suspected" }
  ],
  "recommendedActions": ["List of immediate actions"],
  "suggestedTests": ["List of recommended tests/investigations"],
  "urgencyLevel": "Low|Medium|High|Emergency",
  "urgencyReason": "Explanation for urgency level",
  "followUpRecommendations": ["List of follow-up recommendations"],
  "lifestyleAdvice": ["List of general lifestyle suggestions"],
  "redFlags": ["Any warning signs that need immediate attention"]
}

IMPORTANT: Always respond with valid JSON only. No additional text outside the JSON object.`

// ── POST ─────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/ai')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()

    const parsed = analyzeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { patientId, visitId, type, symptoms, vitals, additionalContext } = parsed.data

    // Fetch patient data to include in AI context
    const patient = await db.patient.findUnique({
      where: { id: patientId },
      select: {
        name: true,
        dateOfBirth: true,
        gender: true,
        bloodGroup: true,
        allergies: true,
        pastTreatments: true,
      },
    })

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Calculate age from date of birth
    let age = 'Unknown'
    if (patient.dateOfBirth) {
      const dob = new Date(patient.dateOfBirth)
      const today = new Date()
      age = String(Math.floor((today.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)))
    }

    // Parse allergies and past treatments
    let allergies: string[] = []
    let pastTreatments: string[] = []
    try {
      allergies = patient.allergies ? JSON.parse(patient.allergies) : []
    } catch { /* ignore parse error */ }
    try {
      pastTreatments = patient.pastTreatments ? JSON.parse(patient.pastTreatments) : []
    } catch { /* ignore parse error */ }

    // Build patient context string
    const patientContext = [
      `Name: ${patient.name}`,
      `Age: ${age}`,
      `Gender: ${patient.gender || 'Unknown'}`,
      `Blood Group: ${patient.bloodGroup || 'Unknown'}`,
      allergies.length > 0 ? `Allergies: ${allergies.join(', ')}` : '',
      pastTreatments.length > 0 ? `Past Treatments: ${pastTreatments.join(', ')}` : '',
      additionalContext ? `Additional Context: ${additionalContext}` : '',
    ].filter(Boolean).join('\n')

    // Build vitals context
    const vitalsContext = vitals
      ? Object.entries(vitals)
          .filter(([, v]) => v)
          .map(([key, v]) => `${key}: ${v}`)
          .join(', ')
      : 'No vitals provided'

    // Construct the user prompt
    const userPrompt = `Analysis Type: ${type}\n\nPatient Information:\n${patientContext}\n\nVitals: ${vitalsContext}\n\nSymptoms: ${symptoms}\n\nPlease provide a comprehensive ${type.toLowerCase()} based on the above information.`

    // Generate unique analysis ID
    const count = await db.aiAnalysis.count()
    const analysisId = `AI-${String(count + 1).padStart(4, '0')}`

    // Store input as JSON
    const inputData = JSON.stringify({
      patientId,
      visitId,
      type,
      symptoms,
      vitals: vitals || null,
      additionalContext: additionalContext || null,
      patientContext: {
        name: patient.name,
        age,
        gender: patient.gender,
        bloodGroup: patient.bloodGroup,
        allergies,
        pastTreatments,
      },
    })

    // Call AI for analysis
    let aiResult: Record<string, unknown> | null = null
    let aiError: string | null = null
    const modelUsed = 'Grok'

    try {
      const zai = await ZAI.create()
      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: 'assistant',
            content: MEDICAL_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        thinking: { type: 'disabled' },
      })

      const rawResponse = completion.choices[0]?.message?.content

      if (!rawResponse || rawResponse.trim().length === 0) {
        throw new Error('AI returned an empty response')
      }

      // Try to parse the AI response as JSON
      try {
        // Strip markdown code fences if present
        const cleaned = rawResponse
          .replace(/^```(?:json)?\s*\n?/i, '')
          .replace(/\n?```\s*$/i, '')
          .trim()
        aiResult = JSON.parse(cleaned)
      } catch {
        // If JSON parsing fails, wrap the raw text response
        aiResult = {
          summary: rawResponse,
          disclaimer: 'AI response could not be parsed as structured data. Please review the text below.',
          possibleConditions: [],
          recommendedActions: [],
          suggestedTests: [],
          urgencyLevel: 'Medium',
          urgencyReason: 'Unable to determine from unstructured response',
          followUpRecommendations: [],
          lifestyleAdvice: [],
          redFlags: [],
          rawResponse,
        }
      }
    } catch (error) {
      aiError = error instanceof Error ? error.message : 'Unknown AI error'
      aiResult = {
        summary: 'AI analysis could not be completed.',
        disclaimer: 'The AI service encountered an error. Please try again later.',
        error: aiError,
        possibleConditions: [],
        recommendedActions: [],
        suggestedTests: [],
        urgencyLevel: 'Medium',
        urgencyReason: 'Analysis could not be completed',
        followUpRecommendations: [],
        lifestyleAdvice: [],
        redFlags: [],
      }
    }

    // Save analysis to database
    const analysis = await db.aiAnalysis.create({
      data: {
        analysisId,
        patientId,
        visitId,
        type,
        input: inputData,
        result: JSON.stringify(aiResult),
        model: modelUsed,
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
        analysisId: analysis.analysisId,
        type,
        patientId,
        patientName: patient.name,
        model: modelUsed,
        error: aiError || undefined,
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({
      data: {
        id: analysis.id,
        analysisId: analysis.analysisId,
        type: analysis.type,
        input: JSON.parse(analysis.input),
        result: aiResult,
        model: analysis.model,
        createdAt: analysis.createdAt,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('[AI_ANALYZE_POST]', error)
    return NextResponse.json(
      { error: 'Failed to perform AI analysis', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
