import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12

function getKeyMaterial() {
  const configuredKey =
    process.env.CAMERA_ENCRYPTION_KEY ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET

  if (!configuredKey) {
    throw new Error('CAMERA_ENCRYPTION_KEY, AUTH_SECRET, or NEXTAUTH_SECRET must be set before saving cameras.')
  }

  return createHash('sha256').update(configuredKey).digest()
}

export function encryptCameraSecret(value: string) {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, getKeyMaterial(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.')
}

export function decryptCameraSecret(payload: string) {
  const [ivValue, tagValue, encryptedValue] = payload.split('.')
  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error('Camera secret payload is invalid.')
  }

  const decipher = createDecipheriv(ALGORITHM, getKeyMaterial(), Buffer.from(ivValue, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}
