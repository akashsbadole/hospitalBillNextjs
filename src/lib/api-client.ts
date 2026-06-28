// Centralized API client for production use
// All frontend components should use these functions instead of raw fetch
// Auth tokens are sent via Authorization header (primary) and httpOnly cookie (backup)

const API_BASE = '/api'

export class ApiError extends Error {
  status: number
  data: unknown

  constructor(status: number, message: string, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

// Get the stored auth token from localStorage (set by Zustand persist)
function getStoredToken(): string | null {
  try {
    const stored = localStorage.getItem('medibill-auth')
    if (stored) {
      const parsed = JSON.parse(stored)
      return parsed?.state?.token || null
    }
  } catch {
    // Ignore
  }
  return null
}

// Get the selected branch ID from the branch store (for multi-tenancy)
function getSelectedBranchId(): string | null {
  try {
    const stored = localStorage.getItem('medibill-branch')
    if (stored) {
      const parsed = JSON.parse(stored)
      return parsed?.state?.selectedBranchId || null
    }
  } catch {
    // Ignore
  }
  return null
}

// Build auth headers from stored token
function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken()
  if (token) {
    return { Authorization: `Bearer ${token}` }
  }
  return {}
}

// Track if we've already handled a 401 to avoid redirect loops
let hasRedirectedOn401 = false

// Reset the 401 redirect flag — call after successful login
export function reset401Redirect(): void {
  hasRedirectedOn401 = false
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`
    let data: unknown
    try {
      const json = await response.json()
      message = json.error || json.message || message
      data = json
    } catch {
      // Response might not be JSON
    }

    // Auto-redirect to login on 401 (expired/invalid token)
    // But prevent infinite loops — only redirect once per session
    if (response.status === 401 && !hasRedirectedOn401) {
      hasRedirectedOn401 = true
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('medibill-auth')
        } catch {
          // Ignore
        }
        window.location.replace('/')
      }
    }

    throw new ApiError(response.status, message, data)
  }
  return response.json()
}

export function buildQueryParams(params: Record<string, string | number | boolean | undefined | null>): string {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value))
    }
  }
  const qs = searchParams.toString()
  return qs ? `?${qs}` : ''
}

export async function apiGet<T>(path: string, params?: Record<string, string | number | boolean | undefined | null>): Promise<T> {
  // Auto-inject selected branchId for multi-tenancy
  const branchId = getSelectedBranchId()
  const mergedParams = branchId ? { ...params, branchId } : params
  const url = `${API_BASE}${path}${mergedParams ? buildQueryParams(mergedParams) : ''}`
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    credentials: 'include',
  })
  return handleResponse<T>(response)
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const url = `${API_BASE}${path}`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(response)
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const url = `${API_BASE}${path}`
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(response)
}

export async function apiDelete<T>(path: string): Promise<T> {
  const url = `${API_BASE}${path}`
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    credentials: 'include',
  })
  return handleResponse<T>(response)
}

// Pagination response type
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// Single item response type
export interface SingleResponse<T> {
  data: T
}

// Error response type
export interface ErrorResponse {
  error: string
  details?: string
}