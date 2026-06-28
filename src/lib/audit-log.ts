import { db } from '@/lib/db'

interface AuditLogInput {
  userId: string
  userName: string
  userEmail: string
  userRole: string
  action: 'LOGIN' | 'LOGOUT' | 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'EXPORT' | 'STATUS_CHANGE'
  module: 'patients' | 'patient-visits' | 'appointments' | 'doctors' | 'billing' | 'payments' | 'prescriptions' | 'medicines' | 'settings' | 'reports' | 'support' | 'auth' | 'users' | 'staff' | 'ai-analysis' | 'calls' | 'insurance' | 'lab-tests' | 'beds' | 'doctor-schedules' | 'inventory' | 'expenses' | 'tds' | 'waste' | 'referrals' | 'feedback' | 'branches' | 'queue' | 'ambulance' | 'blood-bank' | 'imaging' | 'barcode' | 'attendance' | 'leaves' | 'leave-balance' | 'shifts' | 'payroll' | 'surgeries'
  details?: Record<string, unknown>
  ipAddress?: string | null
  userAgent?: string | null
  status?: 'Success' | 'Failed'
}

// Trusted proxy IPs that won't be logged directly (internal infrastructure)
const TRUSTED_PROXIES = new Set([
  '127.0.0.1', '::1', 'localhost',
  '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16',
])

function isTrustedProxy(ip: string): boolean {
  return TRUSTED_PROXIES.has(ip) || ip.startsWith('10.') || ip.startsWith('192.168.') ||
    (ip.startsWith('172.') && parseInt(ip.split('.')[1], 10) >= 16 && parseInt(ip.split('.')[1], 10) <= 31)
}

function sanitizeIp(ip: string | null): string | null {
  if (!ip) return null
  // If it's a trusted proxy, skip it and return null
  if (isTrustedProxy(ip)) return null
  return ip
}

const MAX_AUDIT_RETRIES = 2
const AUDIT_RETRY_DELAY_MS = 1000

async function writeAuditLog(input: AuditLogInput, retries = 0): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: input.userId,
        userName: input.userName,
        userEmail: input.userEmail,
        userRole: input.userRole,
        action: input.action,
        module: input.module,
        details: input.details ? JSON.stringify(input.details) : null,
        ipAddress: sanitizeIp(input.ipAddress ?? null),
        userAgent: input.userAgent || null,
        status: input.status || 'Success',
      },
    })
  } catch (error) {
    if (retries < MAX_AUDIT_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, AUDIT_RETRY_DELAY_MS))
      return writeAuditLog(input, retries + 1)
    }
    // After all retries exhausted, log to stderr (never crash the app)
    console.error('[AUDIT_LOG_ERROR] All retries exhausted:', error)
  }
}

// Log an audit entry (fire-and-forget, non-blocking)
export function logAudit(input: AuditLogInput): void {
  // Use setImmediate to avoid blocking the response
  setImmediate(() => writeAuditLog(input))
}

// Helper to extract IP and User-Agent from a Request object
export function extractRequestInfo(request: Request): { ipAddress: string | null; userAgent: string | null } {
  const headers = request instanceof Request ? request.headers : new Headers()
  return {
    ipAddress: headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || null,
    userAgent: headers.get('user-agent') || null,
  }
}
