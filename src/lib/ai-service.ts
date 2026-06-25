import { GoogleGenerativeAI } from '@google/generative-ai'
import Anthropic from '@anthropic-ai/sdk'

const MEDICAL_IMAGE_SYSTEM_PROMPT = `You are a senior radiologist AI assistant for MediBill Pro hospital management system.
Analyze the provided medical image (X-ray, ultrasound, CT, MRI, mammography, etc.) and provide a structured report.

IMPORTANT: This is a preliminary AI-assisted analysis only. Always include a disclaimer that this is not a substitute for a qualified radiologist's interpretation.

Provide your analysis as structured JSON with the following shape:
{
  "findings": ["List of specific findings observed in the image"],
  "impression": "Overall impression / summary of findings",
  "differentialDiagnosis": ["List of possible diagnoses"],
  "keyObservations": ["Notable features, measurements, or abnormalities"],
  "urgencyLevel": "Normal|Abnormal|Critical",
  "recommendations": ["Suggested follow-up actions or additional investigations"],
  "limitations": ["Any limitations of the AI analysis for this image type"],
  "disclaimer": "Medical disclaimer text"
}

IMPORTANT: Always respond with valid JSON only. No additional text outside the JSON object.`

function getModalitySpecificPrompt(modality: string, bodyPart?: string, clinicalContext?: string): string {
  let prompt = `Medical Image Modality: ${modality}`
  if (bodyPart) prompt += `\nBody Part: ${bodyPart}`
  if (clinicalContext) prompt += `\nClinical Context: ${clinicalContext}`
  prompt += `\n\nPlease analyze this medical image and provide a structured radiology report.`
  return prompt
}

function validateAnalysisResponse(raw: string): Record<string, unknown> {
  const cleaned = raw
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim()
  const parsed = JSON.parse(cleaned)
  return {
    findings: Array.isArray(parsed.findings) ? parsed.findings : [],
    impression: typeof parsed.impression === 'string' ? parsed.impression : 'AI-generated impression pending review',
    differentialDiagnosis: Array.isArray(parsed.differentialDiagnosis) ? parsed.differentialDiagnosis : [],
    keyObservations: Array.isArray(parsed.keyObservations) ? parsed.keyObservations : [],
    urgencyLevel: ['Normal', 'Abnormal', 'Critical'].includes(parsed.urgencyLevel) ? parsed.urgencyLevel : 'Normal',
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
    limitations: Array.isArray(parsed.limitations) ? parsed.limitations : ['AI analysis limitations apply'],
    disclaimer: typeof parsed.disclaimer === 'string'
      ? parsed.disclaimer
      : 'This is an AI-assisted preliminary analysis and does not replace a qualified radiologist report.',
  }
}

export async function analyzeWithGemini(
  imageBuffer: Buffer,
  mimeType: string,
  modality: string,
  bodyPart?: string,
  clinicalContext?: string
): Promise<{ result: Record<string, unknown>; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return { result: getFallbackResult('Gemini API key not configured'), error: 'GEMINI_API_KEY not set' }
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const prompt = MEDICAL_IMAGE_SYSTEM_PROMPT + '\n\n' + getModalitySpecificPrompt(modality, bodyPart, clinicalContext)

    const imageData = imageBuffer.toString('base64')

    const result = await model.generateContent([
      { inlineData: { mimeType, data: imageData } },
      { text: prompt },
    ])

    const response = result.response
    const text = response.text()

    if (!text || text.trim().length === 0) {
      throw new Error('Gemini returned an empty response')
    }

    return { result: validateAnalysisResponse(text) }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Gemini error'
    return { result: getFallbackResult(message), error: message }
  }
}

export async function analyzeWithClaude(
  imageBuffer: Buffer,
  mimeType: string,
  modality: string,
  bodyPart?: string,
  clinicalContext?: string
): Promise<{ result: Record<string, unknown>; error?: string }> {
  const apiKey = process.env.CLAUDE_API_KEY
  if (!apiKey) {
    return { result: getFallbackResult('Claude API key not configured'), error: 'CLAUDE_API_KEY not set' }
  }

  try {
    const anthropic = new Anthropic({ apiKey })

    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
              data: imageBuffer.toString('base64'),
            },
          },
          {
            type: 'text',
            text: MEDICAL_IMAGE_SYSTEM_PROMPT + '\n\n' + getModalitySpecificPrompt(modality, bodyPart, clinicalContext),
          },
        ],
      },
    ]

    const msg = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages,
    })

    const textContent = msg.content.find((block) => block.type === 'text')
    const text = textContent?.type === 'text' ? textContent.text : ''

    if (!text || text.trim().length === 0) {
      throw new Error('Claude returned an empty response')
    }

    return { result: validateAnalysisResponse(text) }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Claude error'
    return { result: getFallbackResult(message), error: message }
  }
}

export async function analyzeMedicalImage(
  imageBuffer: Buffer,
  mimeType: string,
  modality: string,
  options?: { bodyPart?: string; clinicalContext?: string }
): Promise<{
  gemini: { result: Record<string, unknown>; error?: string }
  claude: { result: Record<string, unknown>; error?: string }
}> {
  const [geminiResult, claudeResult] = await Promise.all([
    analyzeWithGemini(imageBuffer, mimeType, modality, options?.bodyPart, options?.clinicalContext),
    analyzeWithClaude(imageBuffer, mimeType, modality, options?.bodyPart, options?.clinicalContext),
  ])

  return { gemini: geminiResult, claude: claudeResult }
}

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/dicom'] as const

export const MODALITY_OPTIONS = [
  { value: 'X-Ray', label: 'X-Ray', bodyParts: ['Chest', 'Skull', 'Spine', 'Abdomen', 'Pelvis', 'Hip', 'Knee', 'Shoulder', 'Elbow', 'Wrist', 'Hand', 'Ankle', 'Foot', 'Sinus', 'Dental'] },
  { value: 'Ultrasound', label: 'Ultrasound / Sonography', bodyParts: ['Abdomen', 'Pelvis', 'Obstetric', 'Breast', 'Thyroid', 'Vascular', 'Musculoskeletal', 'Cardiac'] },
  { value: 'CT', label: 'CT Scan', bodyParts: ['Head', 'Chest', 'Abdomen', 'Spine', 'Pelvis', 'Extremity', 'Angiography'] },
  { value: 'MRI', label: 'MRI', bodyParts: ['Brain', 'Spine', 'Knee', 'Shoulder', 'Abdomen', 'Pelvis', 'Cardiac', 'Breast'] },
  { value: 'Mammography', label: 'Mammography', bodyParts: ['Breast'] },
  { value: 'PET', label: 'PET Scan', bodyParts: ['Whole Body', 'Brain', 'Cardiac'] },
  { value: 'DEXA', label: 'DEXA (Bone Density)', bodyParts: ['Hip', 'Spine', 'Forearm', 'Whole Body'] },
  { value: 'Fluoroscopy', label: 'Fluoroscopy', bodyParts: ['GI Tract', 'Joint', 'Vascular'] },
  { value: 'ECG', label: 'ECG / EKG', bodyParts: ['Cardiac'] },
  { value: 'Other', label: 'Other Imaging', bodyParts: ['General'] },
] as const

function getFallbackResult(errorMessage: string): Record<string, unknown> {
  return {
    findings: [],
    impression: 'AI analysis could not be completed.',
    differentialDiagnosis: [],
    keyObservations: [],
    urgencyLevel: 'Normal' as const,
    recommendations: ['Please consult a radiologist for manual interpretation'],
    limitations: ['AI service error'],
    disclaimer: 'AI analysis could not be completed due to a service error.',
    error: errorMessage,
  }
}
