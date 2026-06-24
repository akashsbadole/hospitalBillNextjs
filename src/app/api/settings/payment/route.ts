import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticateRequest } from '@/lib/api-auth'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'
import { encrypt, decrypt } from '@/lib/crypto'

const updateSchema = z.object({
  razorpayEnabled: z.boolean().optional(),
  razorpayKeyId: z.string().trim().optional(),
  razorpayKeySecret: z.string().trim().optional(),
  razorpayMode: z.enum(['Test', 'Live']).optional(),
  paypalEnabled: z.boolean().optional(),
  paypalClientId: z.string().trim().optional(),
  paypalClientSecret: z.string().trim().optional(),
  paypalMode: z.enum(['Sandbox', 'Live']).optional(),
  paypalCurrency: z.string().trim().optional(),
  upiEnabled: z.boolean().optional(),
  upiVpa: z.string().trim().optional(),
  upiMerchantName: z.string().trim().optional(),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/settings/payment')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })

  try {
    let settings = await db.paymentSettings.findFirst()
    if (!settings) {
      settings = await db.paymentSettings.create({ data: {} })
    }

    const maskedKeySecret = settings.razorpayKeySecret
      ? '••••••••' + decrypt(settings.razorpayKeySecret).slice(-4)
      : null
    const maskedClientSecret = settings.paypalClientSecret
      ? '••••••••' + decrypt(settings.paypalClientSecret).slice(-4)
      : null

    return NextResponse.json({
      data: {
        id: settings.id,
        razorpayEnabled: settings.razorpayEnabled,
        razorpayKeyId: settings.razorpayKeyId || null,
        razorpayKeySecret: maskedKeySecret,
        razorpayMode: settings.razorpayMode,
        paypalEnabled: settings.paypalEnabled,
        paypalClientId: settings.paypalClientId || null,
        paypalClientSecret: maskedClientSecret,
        paypalMode: settings.paypalMode,
        paypalCurrency: settings.paypalCurrency,
        upiEnabled: settings.upiEnabled,
        upiVpa: settings.upiVpa || null,
        upiMerchantName: settings.upiMerchantName || null,
      },
    })
  } catch (error) {
    console.error('[PAYMENT_SETTINGS_GET]', error)
    return NextResponse.json({ error: 'Failed to fetch payment settings' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/settings/payment')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  if (auth.role !== 'Admin') {
    return NextResponse.json({ error: 'Only Admin can modify payment settings' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data
    let settings = await db.paymentSettings.findFirst()
    if (!settings) {
      settings = await db.paymentSettings.create({ data: {} })
    }

    const updateData: Record<string, unknown> = {}
    if (data.razorpayEnabled !== undefined) updateData.razorpayEnabled = data.razorpayEnabled
    if (data.razorpayKeyId !== undefined) updateData.razorpayKeyId = data.razorpayKeyId || null
    if (data.razorpayKeySecret !== undefined) {
      updateData.razorpayKeySecret = data.razorpayKeySecret ? encrypt(data.razorpayKeySecret) : null
    }
    if (data.razorpayMode !== undefined) updateData.razorpayMode = data.razorpayMode
    if (data.paypalEnabled !== undefined) updateData.paypalEnabled = data.paypalEnabled
    if (data.paypalClientId !== undefined) updateData.paypalClientId = data.paypalClientId || null
    if (data.paypalClientSecret !== undefined) {
      updateData.paypalClientSecret = data.paypalClientSecret ? encrypt(data.paypalClientSecret) : null
    }
    if (data.paypalMode !== undefined) updateData.paypalMode = data.paypalMode
    if (data.paypalCurrency !== undefined) updateData.paypalCurrency = data.paypalCurrency
    if (data.upiEnabled !== undefined) updateData.upiEnabled = data.upiEnabled
    if (data.upiVpa !== undefined) updateData.upiVpa = data.upiVpa || null
    if (data.upiMerchantName !== undefined) updateData.upiMerchantName = data.upiMerchantName || null

    const updated = await db.paymentSettings.update({
      where: { id: settings.id },
      data: updateData,
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'UPDATE',
      module: 'settings',
      details: {
        paymentSettings: true,
        razorpayEnabled: data.razorpayEnabled,
        paypalEnabled: data.paypalEnabled,
        upiEnabled: data.upiEnabled,
      },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({
      data: {
        id: updated.id,
        razorpayEnabled: updated.razorpayEnabled,
        razorpayKeyId: updated.razorpayKeyId,
        razorpayMode: updated.razorpayMode,
        paypalEnabled: updated.paypalEnabled,
        paypalClientId: updated.paypalClientId,
        paypalMode: updated.paypalMode,
        paypalCurrency: updated.paypalCurrency,
        upiEnabled: updated.upiEnabled,
        upiVpa: updated.upiVpa,
        upiMerchantName: updated.upiMerchantName,
      },
    })
  } catch (error) {
    console.error('[PAYMENT_SETTINGS_PUT]', error)
    return NextResponse.json({ error: 'Failed to update payment settings' }, { status: 500 })
  }
}

export { decrypt }