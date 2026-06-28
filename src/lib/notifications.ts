import { db } from './db'
import twilio from 'twilio'
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

type NotificationChannel = 'sms' | 'email'
type NotificationType = 'appointment_reminder' | 'payment_confirmation' | 'lab_result' | 'invoice_overdue'

interface NotificationResult {
  success: boolean
  message: string
  channel: NotificationChannel
}

interface TwilioClient {
  messages: {
    create(opts: { body: string; from?: string; to: string }): Promise<unknown>
  }
}

interface SesClient {
  send(command: unknown): Promise<unknown>
}

let twilioClient: TwilioClient | null = null
let sesClient: SesClient | null = null

function getTwilioClient() {
  if (twilioClient) return twilioClient
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (accountSid && authToken) {
    twilioClient = twilio(accountSid, authToken)
    return twilioClient
  }
  return null
}

function getSesClient() {
  if (sesClient) return sesClient
  const region = process.env.AWS_REGION || 'ap-south-1'
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
  if (accessKeyId && secretAccessKey) {
    sesClient = new SESClient({ region, credentials: { accessKeyId, secretAccessKey } })
    return sesClient
  }
  return null
}

function isEnabled(): boolean {
  return process.env.NOTIFICATION_ENABLED === 'true'
}

async function sendSms(to: string, message: string): Promise<boolean> {
  const client = getTwilioClient()
  if (!client) {
    console.warn('[NOTIFICATION] Twilio not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.')
    return false
  }
  try {
    const from = process.env.TWILIO_PHONE_NUMBER
    await client.messages.create({ body: message, from, to })
    return true
  } catch (err) {
    console.error('[NOTIFICATION] Twilio SMS error:', err)
    return false
  }
}

async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  const client = getSesClient()
  if (!client) {
    console.warn('[NOTIFICATION] SES not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.')
    return false
  }
  try {
    const from = process.env.SES_FROM_EMAIL || 'noreply@medibillpro.com'
    await client.send(new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject },
        Body: { Html: { Data: body } },
      },
    }))
    return true
  } catch (err) {
    console.error('[NOTIFICATION] SES email error:', err)
    return false
  }
}

export async function sendNotification(
  type: NotificationType,
  data: Record<string, unknown>,
): Promise<NotificationResult> {
  if (!isEnabled()) {
    console.warn(`[NOTIFICATION] Suppressed (NOTIFICATION_ENABLED is not true). Type: ${type}`)
    return { success: false, message: 'Notification suppressed', channel: 'sms' }
  }

  const channel = (data.channel as NotificationChannel) || 'sms'
  const to = data.to as string || ''
  let success = false
  let message = ''

  if (channel === 'sms' && to) {
    const smsMessage = data.message as string || ''
    if (smsMessage) {
      success = await sendSms(to, smsMessage)
      message = success ? `SMS sent to ${to}` : 'SMS failed'
    }
  } else if (channel === 'email' && to) {
    const subject = data.subject as string || `MediBill Pro: ${type.replace(/_/g, ' ')}`
    const emailBody = data.htmlBody as string || data.message as string || ''
    if (emailBody) {
      success = await sendEmail(to, subject, emailBody)
      message = success ? `Email sent to ${to}` : 'Email failed'
    }
  }

  try {
    const userId = (data.userId as string) || null
    await db.notification.create({
      data: {
        userId: userId || 'system',
        type,
        title: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        message: data.message as string || '',
        link: data.link as string || null,
        linkId: data.linkId as string || null,
        metadata: JSON.stringify(data),
      },
    })
  } catch (err) {
    console.error('[NOTIFICATION] Failed to save notification record:', err)
  }

  return { success, message: message || `Logged: ${type}`, channel }
}

export async function notifyAppointmentReminder(
  patientPhone: string,
  patientName: string,
  doctorName: string,
  date: string,
  time: string,
  userId?: string,
): Promise<NotificationResult> {
  return sendNotification('appointment_reminder', {
    channel: 'sms',
    to: patientPhone,
    patientName,
    doctorName,
    date,
    time,
    userId: userId || '',
    message: `Reminder: ${patientName}, you have an appointment with Dr. ${doctorName} on ${date} at ${time}. Please arrive 10 minutes early.`,
    link: 'appointments',
  })
}

export async function notifyPaymentConfirmation(
  patientPhone: string,
  patientName: string,
  amount: number,
  invoiceNumber: string,
  method: string,
  userId?: string,
): Promise<NotificationResult> {
  return sendNotification('payment_confirmation', {
    channel: 'sms',
    to: patientPhone,
    patientName,
    amount: amount.toFixed(2),
    invoiceNumber,
    method,
    userId: userId || '',
    message: `Payment of ₹${amount.toFixed(2)} received for ${invoiceNumber} via ${method}. Thank you, ${patientName}!`,
    link: 'payments',
  })
}

export async function notifyLabResultReady(
  patientPhone: string,
  patientName: string,
  testName: string,
  userId?: string,
): Promise<NotificationResult> {
  return sendNotification('lab_result', {
    channel: 'sms',
    to: patientPhone,
    patientName,
    testName,
    userId: userId || '',
    message: `Hi ${patientName}, your lab results for "${testName}" are now ready. Please contact the hospital for details.`,
    link: 'lab-tests',
  })
}

export async function notifyInvoiceOverdue(
  patientPhone: string,
  patientName: string,
  invoiceNumber: string,
  amount: number,
  dueDate: string,
  userId?: string,
): Promise<NotificationResult> {
  return sendNotification('invoice_overdue', {
    channel: 'sms',
    to: patientPhone,
    patientName,
    invoiceNumber,
    amount: amount.toFixed(2),
    dueDate,
    userId: userId || '',
    message: `Reminder: ${patientName}, your invoice ${invoiceNumber} for ₹${amount.toFixed(2)} was due on ${dueDate}. Please make the payment at your earliest convenience.`,
    link: 'billing',
  })
}
