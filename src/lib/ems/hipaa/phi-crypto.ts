import crypto from 'crypto'

const ALGO = 'aes-256-gcm'
const KEY_ENV = 'EMS_PHI_ENCRYPTION_KEY'
const ENCRYPTED_PREFIX = 'phi:'

export const PHI_PATIENT_FIELDS = ['name', 'dateOfBirth', 'ssn', 'medicalHistory', 'medications', 'allergies', 'insuranceInfo'] as const

function getKey(): Buffer {
  const raw = process.env[KEY_ENV]
  if (!raw) {
    if (process.env.NODE_ENV === 'production') throw new Error(`${KEY_ENV} env var missing — PHI encryption disabled`)
    // Dev fallback — deterministic, never use in prod
    return Buffer.alloc(32, 0x42)
  }
  const buf = Buffer.from(raw.replace(/^0x/, ''), 'hex')
  if (buf.length !== 32) throw new Error(`${KEY_ENV} must be 32 bytes (64 hex chars), got ${buf.length}`)
  return buf
}

export function encryptPhi(plaintext: string): string {
  if (!plaintext) return plaintext
  if (plaintext.startsWith(ENCRYPTED_PREFIX)) return plaintext // already encrypted
  const key = getKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${ENCRYPTED_PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decryptPhi(ciphertext: string): string {
  if (!ciphertext) return ciphertext
  if (!ciphertext.startsWith(ENCRYPTED_PREFIX)) return ciphertext // plaintext (legacy data)
  const key = getKey()
  const payload = ciphertext.slice(ENCRYPTED_PREFIX.length)
  const [ivHex, tagHex, dataHex] = payload.split(':')
  if (!ivHex || !tagHex || !dataHex) throw new Error('Malformed encrypted PHI')
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8')
}

export function encryptPhiRecord<T extends Record<string, unknown>>(obj: T, fields: readonly string[]): T {
  const out = { ...obj }
  for (const f of fields) {
    if (typeof (out as any)[f] === 'string') (out as any)[f] = encryptPhi((out as any)[f])
  }
  return out
}

export function decryptPhiRecord<T extends Record<string, unknown>>(obj: T, fields: readonly string[]): T {
  const out = { ...obj }
  for (const f of fields) {
    if (typeof (out as any)[f] === 'string') {
      try { (out as any)[f] = decryptPhi((out as any)[f]) } catch { /* corrupted — return raw */ }
    }
  }
  return out
}

export function isEncrypted(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX)
}

// Generate a new key for first-time setup
export function generatePhiKey(): string {
  return crypto.randomBytes(32).toString('hex')
}
