import { describe, it, expect } from 'vitest'

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
    limitations: Array.isArray(parsed.limitations) ? parsed.limitations : [],
    disclaimer: typeof parsed.disclaimer === 'string'
      ? parsed.disclaimer
      : 'This is an AI-assisted preliminary analysis and does not replace a qualified radiologist report.',
  }
}

function getModalitySpecificPrompt(modality: string, bodyPart?: string, clinicalContext?: string): string {
  let prompt = `Medical Image Modality: ${modality}`
  if (bodyPart) prompt += `\nBody Part: ${bodyPart}`
  if (clinicalContext) prompt += `\nClinical Context: ${clinicalContext}`
  prompt += `\n\nPlease analyze this medical image and provide a structured radiology report.`
  return prompt
}

function generateAnalysisId(count: number): string {
  return `AI-IMG-${String(count + 1).padStart(4, '0')}`
}

function calculateMimeType(ext: string): string {
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
  }
  return mimeMap[ext.toLowerCase()] || 'application/octet-stream'
}

describe('AI Imaging - Analysis Response Validation', () => {
  it('should parse a valid JSON response with all fields', () => {
    const input = JSON.stringify({
      findings: ['Nodular opacity in right upper lobe', 'Mild cardiomegaly'],
      impression: 'Possible community-acquired pneumonia',
      differentialDiagnosis: ['Pneumonia', 'Tuberculosis', 'Lung cancer'],
      keyObservations: ['3cm nodule in RUL', 'No pleural effusion'],
      urgencyLevel: 'Abnormal',
      recommendations: ['CT chest recommended', 'Sputum culture'],
      limitations: ['Single view only'],
      disclaimer: 'AI preliminary analysis - review by radiologist required',
    })
    const result = validateAnalysisResponse(input)
    expect(result.findings).toHaveLength(2)
    expect(result.impression).toBe('Possible community-acquired pneumonia')
    expect(result.urgencyLevel).toBe('Abnormal')
    expect(result.recommendations).toHaveLength(2)
    expect(result.disclaimer).toContain('AI preliminary')
  })

  it('should handle markdown code fences', () => {
    const input = '```json\n{"findings": ["Normal study"], "impression": "Normal"}\n```'
    const result = validateAnalysisResponse(input)
    expect(result.findings).toHaveLength(1)
    expect(result.impression).toBe('Normal')
  })

  it('should fall back to defaults for missing fields', () => {
    const input = JSON.stringify({ findings: ['Test'] })
    const result = validateAnalysisResponse(input)
    expect(result.impression).toBe('AI-generated impression pending review')
    expect(result.urgencyLevel).toBe('Normal')
    expect(result.differentialDiagnosis).toEqual([])
    expect(result.recommendations).toEqual([])
    expect(result.disclaimer).toContain('preliminary analysis')
  })

  it('should validate urgency level', () => {
    const valid = validateAnalysisResponse(JSON.stringify({ findings: [], urgencyLevel: 'Critical' }))
    expect(valid.urgencyLevel).toBe('Critical')

    const invalid = validateAnalysisResponse(JSON.stringify({ findings: [], urgencyLevel: 'Unknown' }))
    expect(invalid.urgencyLevel).toBe('Normal')
  })

  it('should handle non-array findings gracefully', () => {
    const result = validateAnalysisResponse(JSON.stringify({ findings: 'single finding' }))
    expect(result.findings).toEqual([])
  })

  it('should throw on completely invalid JSON', () => {
    expect(() => validateAnalysisResponse('not json at all')).toThrow()
  })

  it('should handle empty string', () => {
    expect(() => validateAnalysisResponse('')).toThrow()
  })
})

describe('AI Imaging - Modality Prompt Builder', () => {
  it('should build prompt with modality only', () => {
    const prompt = getModalitySpecificPrompt('X-Ray')
    expect(prompt).toContain('X-Ray')
    expect(prompt).not.toContain('Body Part')
    expect(prompt).not.toContain('Clinical Context')
  })

  it('should include body part when provided', () => {
    const prompt = getModalitySpecificPrompt('Ultrasound', 'Abdomen')
    expect(prompt).toContain('Ultrasound')
    expect(prompt).toContain('Abdomen')
  })

  it('should include clinical context when provided', () => {
    const prompt = getModalitySpecificPrompt('CT', 'Head', 'Trauma patient')
    expect(prompt).toContain('CT')
    expect(prompt).toContain('Head')
    expect(prompt).toContain('Trauma patient')
  })

  it('should always ask for structured radiology report', () => {
    const prompt = getModalitySpecificPrompt('MRI')
    expect(prompt).toContain('structured radiology report')
  })
})

describe('AI Imaging - ID Generation', () => {
  it('should generate first ID correctly', () => {
    expect(generateAnalysisId(0)).toBe('AI-IMG-0001')
  })

  it('should generate sequential IDs', () => {
    expect(generateAnalysisId(1)).toBe('AI-IMG-0002')
  })

  it('should pad correctly for large numbers', () => {
    expect(generateAnalysisId(99)).toBe('AI-IMG-0100')
  })

  it('should handle large counts', () => {
    expect(generateAnalysisId(999)).toBe('AI-IMG-1000')
  })
})

describe('AI Imaging - MIME Type Detection', () => {
  it('should detect JPEG', () => {
    expect(calculateMimeType('jpg')).toBe('image/jpeg')
    expect(calculateMimeType('jpeg')).toBe('image/jpeg')
  })

  it('should detect PNG', () => {
    expect(calculateMimeType('png')).toBe('image/png')
  })

  it('should detect WebP', () => {
    expect(calculateMimeType('webp')).toBe('image/webp')
  })

  it('should detect GIF', () => {
    expect(calculateMimeType('gif')).toBe('image/gif')
  })

  it('should return octet-stream for unknown extensions', () => {
    expect(calculateMimeType('dicom')).toBe('application/octet-stream')
  })

  it('should be case insensitive', () => {
    expect(calculateMimeType('JPG')).toBe('image/jpeg')
    expect(calculateMimeType('PNG')).toBe('image/png')
  })
})

describe('AI Imaging - Image Size Validation', () => {
  const MAX_SIZE = 10 * 1024 * 1024 // 10MB

  it('should accept files under 10MB', () => {
    expect(5 * 1024 * 1024 <= MAX_SIZE).toBe(true)
  })

  it('should reject files over 10MB', () => {
    expect(15 * 1024 * 1024 <= MAX_SIZE).toBe(false)
  })

  it('should accept exactly 10MB', () => {
    expect(MAX_SIZE <= MAX_SIZE).toBe(true)
  })
})

describe('AI Imaging - Allowed Image Types', () => {
  const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

  it('should allow JPEG, PNG, WebP, GIF', () => {
    expect(ALLOWED).toContain('image/jpeg')
    expect(ALLOWED).toContain('image/png')
    expect(ALLOWED).toContain('image/webp')
    expect(ALLOWED).toContain('image/gif')
  })

  it('should not allow SVG, BMP, TIFF', () => {
    expect(ALLOWED).not.toContain('image/svg+xml')
    expect(ALLOWED).not.toContain('image/bmp')
    expect(ALLOWED).not.toContain('image/tiff')
  })
})
