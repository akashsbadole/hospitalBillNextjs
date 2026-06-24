import { db } from '@/lib/db'

interface AuditLogInput {
  userId: string
  userName: string
  userEmail: string
  userRole: string
  action: 'LOGIN' | 'LOGOUT' | 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'EXPORT' | 'STATUS_CHANGE'
  module: 'patients' | 'patient-visits' | 'appointments' | 'doctors' | 'billing' | 'payments' | 'prescriptions' | 'medicines' | 'settings' | 'reports' | 'support' | 'auth' | 'users' | 'staff' | 'ai-analysis' | 'calls' | 'insurance' | 'lab-tests' | 'beds' | 'doctor-schedules' | 'inventory' | 'expenses' | 'tds' | 'waste' | 'referrals' | 'feedback' | 'branches' | 'queue' | 'ambulance' | 'blood-bank' | 'imaging' | 'barcode'
  details?: Record<string, unknown>
  ipAddress?: string | null
  userAgent?: string | null
  status?: 'Success' | 'Failed'
}

// Log an audit entry (fire-and-forget, non-blocking)
export function logAudit(input: AuditLogInput): void {
  // Use setImmediate to avoid blocking the response
  setImmediate(async () => {
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
          ipAddress: input.ipAddress || null,
          userAgent: input.userAgent || null,
          status: input.status || 'Success',
        },
      })
    } catch (error) {
      // Audit logging should never crash the app
      console.error('[AUDIT_LOG_ERROR]', error)
    }
  })
}

// Helper to extract IP and User-Agent from a Request object
export function extractRequestInfo(request: Request): { ipAddress: string | null; userAgent: string | null } {
  // For Next.js, headers are available via request.headers
  const headers = request instanceof Request ? request.headers : new Headers()
  return {
    ipAddress: headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || null,
    userAgent: headers.get('user-agent') || null,
  }
}
