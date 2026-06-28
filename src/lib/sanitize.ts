// Frontend input sanitization — prevents XSS when rendering user-supplied data

const ENTITY_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
}

export function escapeHtml(str: string): string {
  return str.replace(/[&<>"'/]/g, char => ENTITY_MAP[char] || char)
}

export function sanitizeText(value: string | null | undefined): string {
  if (!value) return ''
  return escapeHtml(value.trim())
}

export function sanitizePhone(value: string | null | undefined): string {
  if (!value) return ''
  return value.replace(/[^\d+\-\s()]/g, '').trim()
}

export function sanitizeEmail(value: string | null | undefined): string {
  if (!value) return ''
  return value.trim().toLowerCase()
}

export function sanitizeNumeric(value: string | null | undefined): string {
  if (!value) return ''
  // Allow only digits and a single decimal point; collapse multiple dots
  const cleaned = value.replace(/[^\d.]/g, '')
  const parts = cleaned.split('.')
  if (parts.length > 2) {
    return parts[0] + '.' + parts.slice(1).join('')
  }
  return cleaned.trim()
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeText(value)
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized as T
}

// Escape SQL LIKE wildcards (% and _) to prevent query-pattern manipulation
// Use this when passing user input to Prisma's `contains` filter
export function escapeLikeWildcard(value: string): string {
  return value.replace(/[%_]/g, char => `\\${char}`)
}

// Sanitize search input: trim, escape LIKE wildcards, limit length
export function sanitizeSearchInput(value: string | null | undefined, maxLength = 100): string {
  if (!value) return ''
  return escapeLikeWildcard(value.trim().slice(0, maxLength))
}
