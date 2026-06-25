// API Auth Middleware — validates JWT tokens and checks RBAC permissions
// Import this in every API route handler (except /api/auth/*)
//
// MULTI-TENANCY: authenticateRequest now fetches the user's branchId from DB
// and returns it in the auth result. Use getTenantFilter() to get the Prisma
// where clause for branch-scoped queries.

import { cookies } from 'next/headers'
import { verifyToken } from './auth'
import { canAccessApi, canWrite, type Role } from './rbac'
import { db } from './db'

interface AuthResult {
  authenticated: boolean
  user: { id: string; userId: string; email: string; role: string; branchId: string | null } | null
  userId: string | null
  role: Role | null
  branchId: string | null   // The user's assigned branch (null = can access all, typically Admin)
  error: { status: number; message: string } | null
}

// Cache user branch lookups to avoid DB hits on every request (in-memory, short TTL)
const branchCache = new Map<string, { branchId: string | null; fetchedAt: number }>()
const BRANCH_CACHE_TTL = 30_000 // 30 seconds

// Periodic cleanup to prevent unbounded memory growth
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, value] of branchCache) {
      if (now - value.fetchedAt > BRANCH_CACHE_TTL * 2) {
        branchCache.delete(key)
      }
    }
  }, BRANCH_CACHE_TTL * 10)
}

export async function authenticateRequest(request: Request, requiredRoute?: string): Promise<AuthResult> {
  try {
    // Get token from Authorization header or cookie
    const authHeader = request.headers.get('authorization')
    const cookieStore = await cookies()
    const token = authHeader?.replace('Bearer ', '') || cookieStore.get('medibill_token')?.value

    if (!token) {
      return { authenticated: false, user: null, userId: null, role: null, branchId: null, error: { status: 401, message: 'Authentication required. Please log in.' } }
    }

    const decoded = await verifyToken(token)
    if (!decoded) {
      return { authenticated: false, user: null, userId: null, role: null, branchId: null, error: { status: 401, message: 'Invalid or expired token. Please log in again.' } }
    }

    // Verify tokenVersion matches DB (invalidates sessions on password change)
    if (decoded.tokenVersion !== undefined) {
      const versionCheck = await db.user.findUnique({
        where: { id: decoded.id },
        select: { tokenVersion: true },
      })
      if (!versionCheck || versionCheck.tokenVersion !== decoded.tokenVersion) {
        return { authenticated: false, user: null, userId: null, role: null, branchId: null, error: { status: 401, message: 'Session invalidated. Please log in again.' } }
      }
    }

    const role = decoded.role as Role

    // Check route-level access
    if (requiredRoute && !canAccessApi(role, requiredRoute)) {
      return { authenticated: true, user: { ...decoded, branchId: null }, userId: decoded.id, role, branchId: null, error: { status: 403, message: `Access denied. ${role} role cannot access this resource.` } }
    }

    // Fetch user's branchId with caching
    const cached = branchCache.get(decoded.id)
    let branchId: string | null = null
    if (cached && Date.now() - cached.fetchedAt < BRANCH_CACHE_TTL) {
      branchId = cached.branchId
    } else {
      const dbUser = await db.user.findUnique({
        where: { id: decoded.id },
        select: { branchId: true, role: true },
      })
      branchId = dbUser?.branchId || null
      branchCache.set(decoded.id, { branchId, fetchedAt: Date.now() })
    }

    return {
      authenticated: true,
      user: { ...decoded, branchId },
      userId: decoded.id,
      role,
      branchId,
      error: null,
    }
  } catch {
    return { authenticated: false, user: null, userId: null, role: null, branchId: null, error: { status: 401, message: 'Authentication error.' } }
  }
}

// ─── Multi-Tenancy Helper ─────────────────────────────────────────────────
//
// Returns a Prisma `where` clause that scopes queries to the current user's branch.
//
// Behavior:
//   - Admin WITHOUT a branchId → returns empty filter (sees ALL branches)
//   - Admin WITH a branchId + no overrideBranchId → scoped to their branch
//   - Admin WITH overrideBranchId (from frontend switcher) → scoped to that branch
//   - Non-Admin users → ALWAYS scoped to their own branch (cannot override)
//
// Usage in API routes:
//   const { branchId } = await authenticateRequest(request, '/api/patients')
//   const filter = getTenantFilter(role, branchId, request)
//   const patients = await db.patient.findMany({ where: { ...filter, ...otherFilters } })

export function getTenantFilter(
  role: Role | string | null,
  userBranchId: string | null,
  request?: Request,
): Record<string, unknown> {
  if (!userBranchId) {
    // Admin with no branch assignment can see all branches
    // Unless a specific branch is requested via query param
    if (request && role === 'Admin') {
      const url = new URL(request.url)
      const overrideBranch = url.searchParams.get('branchId')
      if (overrideBranch) {
        return { branchId: overrideBranch }
      }
    }
    return {} // No filter — sees everything
  }

  // Non-admin or admin with branch assignment → always scoped
  return { branchId: userBranchId }
}

// Returns the branchId that should be used when CREATING records.
// Non-admin users always use their own branch.
// Admin can override via query param (from branch switcher).
export function getCreateBranchId(
  role: Role | string | null,
  userBranchId: string | null,
  request?: Request,
  bodyBranchId?: string | null,
): string | null {
  // If the body explicitly provides a branchId and user is admin, allow it
  if (role === 'Admin' && bodyBranchId) {
    return bodyBranchId
  }

  // Admin with no branch: check query param for override
  if (role === 'Admin' && !userBranchId && request) {
    const url = new URL(request.url)
    const overrideBranch = url.searchParams.get('branchId')
    if (overrideBranch) return overrideBranch
  }

  // Default: use user's branch
  return userBranchId
}

// Quick check for read vs write access
export function checkWritePermission(role: Role, method: string): { allowed: boolean; error?: string } {
  if (method === 'GET' || method === 'HEAD') return { allowed: true }

  const perms = canWrite(role)
  if (method === 'POST' && !perms.create) {
    return { allowed: false, error: `${role} role does not have create permission.` }
  }
  if ((method === 'PUT' || method === 'PATCH') && !perms.update) {
    return { allowed: false, error: `${role} role does not have update permission.` }
  }
  if (method === 'DELETE' && !perms.delete) {
    return { allowed: false, error: `${role} role does not have delete permission.` }
  }
  return { allowed: true }
}

// Module gating — check if a module is enabled before processing request
// Returns an error response if the module is disabled, null if allowed.
// Cache result for 10s to avoid DB hit on every request.
const moduleGateCache = new Map<string, { enabled: boolean; checkedAt: number }>()
const MODULE_GATE_CACHE_TTL = 10_000

// Periodic cleanup to prevent unbounded memory growth
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, value] of moduleGateCache) {
      if (now - value.checkedAt > MODULE_GATE_CACHE_TTL * 2) {
        moduleGateCache.delete(key)
      }
    }
  }, MODULE_GATE_CACHE_TTL * 10)
}

export async function checkModuleEnabled(moduleKey: string): Promise<{ allowed: boolean; error?: { status: number; message: string } }> {
  const cached = moduleGateCache.get(moduleKey)
  if (cached && Date.now() - cached.checkedAt < MODULE_GATE_CACHE_TTL) {
    if (!cached.enabled) {
      return { allowed: false, error: { status: 403, message: `"${moduleKey}" module is currently disabled. Contact Super Admin to enable it.` } }
    }
    return { allowed: true }
  }

  try {
    const mod = await db.moduleSetting.findUnique({
      where: { moduleKey },
      select: { enabled: true },
    })

    const enabled = mod?.enabled ?? true
    moduleGateCache.set(moduleKey, { enabled, checkedAt: Date.now() })

    if (!enabled) {
      return { allowed: false, error: { status: 403, message: `"${moduleKey}" module is currently disabled. Contact Super Admin to enable it.` } }
    }
    return { allowed: true }
  } catch {
    // If DB is unreachable, allow access (fail open)
    return { allowed: true }
  }
}