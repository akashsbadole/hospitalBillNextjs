// Centralized environment variable validation at startup
// Import this first in server.ts or next.config.ts to fail fast

type EnvConfig = {
  required: string[]
  optional: Record<string, string>
}

const REQUIRED: string[] = [
  'DATABASE_URL',
  'JWT_SECRET',
  'ENCRYPTION_KEY',
]

const OPTIONAL: Record<string, string> = {
  'NEXT_PUBLIC_SHOW_DEMO': 'false',
  'NEXT_PUBLIC_A11Y_DEBUG': 'false',
  'NOTIFICATION_ENABLED': 'false',
  'SOCKET_PORT': '3001',
  'BACKUP_RETENTION_DAYS': '7',
  'GEMINI_API_KEY': '',
  'CLAUDE_API_KEY': '',
}

let validated = false

export function validateEnv(): void {
  if (validated) return

  const missing: string[] = []

  for (const key of REQUIRED) {
    if (!process.env[key] || process.env[key]!.trim() === '') {
      missing.push(key)
    }
  }

  if (missing.length > 0) {
    const msg = `[ENV] Missing required environment variables:\n  ${missing.join('\n  ')}\n\nCheck your .env file or environment configuration.`
    console.error(msg)
    throw new Error(msg)
  }

  // Validate JWT_SECRET length
  const jwtSecret = process.env.JWT_SECRET!
  if (jwtSecret.length < 32) {
    console.warn('[ENV] WARNING: JWT_SECRET is less than 32 characters. Use a stronger secret in production.')
  }

  // Validate DATABASE_URL format
  const dbUrl = process.env.DATABASE_URL!
  if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
    throw new Error('[ENV] DATABASE_URL must start with postgresql:// or postgres://')
  }

  // Set defaults for optional vars
  for (const [key, defaultValue] of Object.entries(OPTIONAL)) {
    if (!process.env[key]) {
      process.env[key] = defaultValue
    }
  }

  validated = true
  console.log('[ENV] All required environment variables are set.')
}
