import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { validateGSTIN } from '@/lib/utils'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'

// ── Schemas ──────────────────────────────────────────────────────────────
const updateSettingsSchema = z.object({
  clinicName: z.string().trim().min(1, 'Clinic name is required').max(200).optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  pincode: z.string().trim().max(10).optional(),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().email('Invalid email format').optional().or(z.literal('')),
  website: z.string().trim().url('Invalid URL format').optional().or(z.literal('')),
  gstin: z.string().trim().optional(),
  gstType: z.enum(['None', 'Regular', 'Composition']).optional(),
  logo: z.string().trim().optional(),
})

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const auth = await authenticateRequest(request, '/api/settings')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  try {
    let settings = await db.clinicSettings.findFirst()

    // Create default settings if none exist
    if (!settings) {
      settings = await db.clinicSettings.create({
        data: {
          clinicName: 'My Hospital / Clinic',
        },
      })
    }

    return NextResponse.json({ data: settings })
  } catch (error) {
    console.error('[SETTINGS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── PUT (upsert) ─────────────────────────────────────────────────────────
export async function PUT(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/settings')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'PUT')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = updateSettingsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Validate GSTIN format if provided
    if (data.gstin !== undefined && data.gstin !== '') {
      if (!validateGSTIN(data.gstin)) {
        return NextResponse.json(
          { error: 'Invalid GSTIN format', details: 'GSTIN must be 15 characters (e.g., 22AAAAA0000A1Z5)' },
          { status: 400 }
        )
      }
    }

    const existing = await db.clinicSettings.findFirst()

    let settings
    if (existing) {
      settings = await db.clinicSettings.update({
        where: { id: existing.id },
        data: {
          ...data,
          email: data.email === '' ? null : data.email,
          website: data.website === '' ? null : data.website,
          gstin: data.gstin === '' ? null : data.gstin,
        },
      })
    } else {
      settings = await db.clinicSettings.create({
        data: {
          clinicName: data.clinicName ?? 'My Hospital / Clinic',
          ...data,
          email: data.email === '' ? null : data.email,
          website: data.website === '' ? null : data.website,
          gstin: data.gstin === '' ? null : data.gstin,
        },
      })
    }

    return NextResponse.json({ data: settings })
  } catch (error) {
    console.error('[SETTINGS_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update settings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
