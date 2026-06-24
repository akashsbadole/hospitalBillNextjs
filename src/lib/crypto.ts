import crypto from 'crypto'

const ALGORITHM = 'aes-256-cbc'
const KEY_VERSIONS_SEPARATOR = '---'

function getEncryptionKeys(): string[] {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) {
    throw new Error('ENCRYPTION_KEY environment variable is required')
  }
  // Support key rotation: ENCRYPTION_KEY=v2_key---v1_key
  // First key is the current (newest), rest are old keys for decryption
  return raw.split(KEY_VERSIONS_SEPARATOR).map(k => k.trim()).filter(Boolean)
}

function getCurrentKey(): string {
  return getEncryptionKeys()[0]
}

function deriveKey(keyMaterial: string): Buffer {
  return crypto.scryptSync(keyMaterial, 'medibill-enc-salt', 32)
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16)
  const key = deriveKey(getCurrentKey())
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  // Prefix with version marker (v0 = current key)
  return 'v0:' + iv.toString('hex') + ':' + encrypted
}

export function decrypt(text: string): string {
  // Support format: v{version}:iv:encrypted OR legacy iv:encrypted
  const parts = text.split(':')

  let version = 0
  let ivHex: string
  let encryptedHex: string

  if (parts.length === 3 && parts[0].startsWith('v')) {
    version = parseInt(parts[0].slice(1), 10) || 0
    ivHex = parts[1]
    encryptedHex = parts[2]
  } else if (parts.length === 2) {
    ivHex = parts[0]
    encryptedHex = parts[1]
  } else {
    throw new Error('Invalid encrypted text format')
  }

  const keys = getEncryptionKeys()
  const keyMaterial = keys[version] || keys[0]
  const key = deriveKey(keyMaterial)
  const iv = Buffer.from(ivHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

export async function reEncryptWithCurrentKey(text: string): Promise<string> {
  const decrypted = decrypt(text)
  return encrypt(decrypted)
}
