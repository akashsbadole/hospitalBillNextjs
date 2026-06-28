import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generateWhatsAppId } from '@/lib/utils'
import { authenticateRequest, checkWritePermission } from '@/lib/api-auth'
import twilio from 'twilio'
import { logAudit, extractRequestInfo } from '@/lib/audit-log'

const whatsappTemplates = ['prescription', 'invoice', 'appointment_reminder', 'payment_receipt', 'lab_report'] as const
const entityTypes = ['Prescription', 'Invoice', 'Appointment', 'Payment', 'LabTestOrder'] as const

const sendWhatsAppSchema = z.object({
  to: z.string().trim().min(1, 'Phone number is required').regex(/^\+?\d{10,15}$/, 'Invalid phone number'),
  template: z.enum(whatsappTemplates),
  entityType: z.enum(entityTypes),
  entityId: z.string().trim().min(1, 'Entity ID is required'),
  messageBody: z.string().trim().min(1, 'Message body is required'),
  mediaUrl: z.string().url('Invalid media URL').optional(),
})

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (accountSid && authToken) {
    return twilio(accountSid, authToken)
  }
  return null
}

function generateTemplateMessage(template: string, entityType: string): string {
  const clinicName = process.env.CLINIC_NAME || 'MediBill Pro'
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://medibillpro.com'

  switch (template) {
    case 'prescription':
      return `Your prescription from ${clinicName} is ready. View it here: ${baseUrl}/prescriptions/${entityType}`
    case 'invoice':
      return `Your invoice from ${clinicName} is ready. View it here: ${baseUrl}/billing/${entityType}`
    case 'appointment_reminder':
      return `Reminder from ${clinicName}: You have an upcoming appointment. View details: ${baseUrl}/appointments/${entityType}`
    case 'payment_receipt':
      return `Payment receipt from ${clinicName}. View it here: ${baseUrl}/payments/${entityType}`
    case 'lab_report':
      return `Your lab report from ${clinicName} is ready. View it here: ${baseUrl}/lab-tests/${entityType}`
    default:
      return `Message from ${clinicName} regarding your ${entityType.toLowerCase()}`
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, '/api/whatsapp')
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status })
  const writeCheck = checkWritePermission(auth.role!, 'POST')
  if (!writeCheck.allowed) return NextResponse.json({ error: writeCheck.error }, { status: 403 })

  try {
    const body = await request.json()

    const parsed = sendWhatsAppSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Generate message if not provided (template-based)
    const messageBody = data.messageBody || generateTemplateMessage(data.template, data.entityId)

    // Auto-generate messageId
    const lastMessage = await db.whatsAppMessage.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { messageId: true },
    })
    const messageId = generateWhatsAppId(lastMessage?.messageId ?? null)

    const twilioClient = getTwilioClient()
    let providerRef: string | null = null
    let status = 'Sent'
    let errorMessage: string | null = null

    // Try sending via Twilio WhatsApp
    if (twilioClient) {
      try {
        const twilioFrom = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'
        const twilioTo = `whatsapp:${data.to.startsWith('+') ? data.to : `+${data.to}`}`

        const messageOptions: { from: string; to: string; body: string; mediaUrl?: string[] } = {
          from: twilioFrom,
          to: twilioTo,
          body: messageBody,
        }
        if (data.mediaUrl) {
          messageOptions.mediaUrl = [data.mediaUrl]
        }

        const twilioMsg = await twilioClient.messages.create(messageOptions)
        providerRef = twilioMsg.sid ?? null
      } catch (err: unknown) {
        console.error('[WHATSAPP_SEND] Twilio error:', err)
        errorMessage = err instanceof Error ? err.message : 'Twilio send failed'

        // Fallback: try SMS as fallback
        try {
          const smsFrom = process.env.TWILIO_PHONE_NUMBER
          if (smsFrom) {
            const smsTo = data.to.startsWith('+') ? data.to : `+${data.to}`
            await twilioClient.messages.create({
              body: messageBody,
              from: smsFrom,
              to: smsTo,
            })
            status = 'Sent'
            errorMessage = null
          }
        } catch (smsErr: unknown) {
          console.error('[WHATSAPP_SEND] SMS fallback also failed:', smsErr)
          status = 'Failed'
          errorMessage = err instanceof Error ? err.message : 'Unknown error'
        }
      }
    } else {
      console.warn('[WHATSAPP_SEND] Twilio not configured')
      status = 'Failed'
      errorMessage = 'Twilio not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.'
    }

    // Save WhatsAppMessage record to DB
    await db.whatsAppMessage.create({
      data: {
        messageId,
        to: data.to,
        template: data.template,
        entityType: data.entityType,
        entityId: data.entityId,
        messageBody,
        mediaUrl: data.mediaUrl ?? null,
        status,
        providerRef,
        error: errorMessage,
      },
    })

    logAudit({
      userId: auth.user!.id,
      userName: auth.user!.email,
      userEmail: auth.user!.email,
      userRole: auth.role!,
      action: 'CREATE',
      module: 'insurance',
      details: { messageId, template: data.template, to: data.to, entityType: data.entityType, entityId: data.entityId, status },
      ...extractRequestInfo(request),
    })

    return NextResponse.json({
      success: status !== 'Failed',
      data: {
        messageId,
        providerRef,
        status,
      },
    }, { status: status === 'Failed' ? 200 : 201 })
  } catch (error) {
    console.error('[WHATSAPP_SEND_POST]', error)
    return NextResponse.json(
      { error: 'Failed to send WhatsApp message', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
