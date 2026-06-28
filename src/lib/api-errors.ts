// Safe error detail extraction for API responses
// In development: returns the actual error message for debugging
// In production: returns a generic message to prevent leaking internals

export function errorDetails(error: unknown): string | undefined {
  if (process.env.NODE_ENV === 'development') {
    return error instanceof Error ? error.message : 'Unknown error'
  }
  return undefined
}
