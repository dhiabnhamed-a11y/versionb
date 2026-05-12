import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { logger } from '@/modules/shared/logger'

type EncryptedEnvelope = {
  v: 1
  alg: 'aes-256-gcm'
  keyId: string
  iv: string
  tag: string
  ciphertext: string
}

function deriveFallbackKey() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('SOCIAL_TOKEN_ENCRYPTION_KEY or AUTH_SECRET is required for social token encryption.')
  }
  logger.warn('integrations.token_crypto_using_auth_secret_fallback')
  return createHash('sha256').update(secret).digest()
}

function getEncryptionKey() {
  const configured = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY
  if (!configured) return { key: deriveFallbackKey(), keyId: 'auth-secret-derived' }

  const key = Buffer.from(configured, 'base64')
  if (key.length !== 32) {
    throw new Error('SOCIAL_TOKEN_ENCRYPTION_KEY must be a base64 encoded 32-byte key.')
  }

  return { key, keyId: process.env.SOCIAL_TOKEN_ENCRYPTION_KEY_ID || 'primary' }
}

export function encryptToken(plaintext: string) {
  const { key, keyId } = getEncryptionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const envelope: EncryptedEnvelope = {
    v: 1,
    alg: 'aes-256-gcm',
    keyId,
    iv: iv.toString('base64url'),
    tag: tag.toString('base64url'),
    ciphertext: ciphertext.toString('base64url'),
  }
  return Buffer.from(JSON.stringify(envelope)).toString('base64url')
}

export function decryptToken(encrypted: string) {
  const envelope = JSON.parse(Buffer.from(encrypted, 'base64url').toString('utf8')) as EncryptedEnvelope
  if (envelope.v !== 1 || envelope.alg !== 'aes-256-gcm') throw new Error('Unsupported social token envelope.')

  const { key } = getEncryptionKey()
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64url')), decipher.final()]).toString('utf8')
}

export function currentTokenKeyId() {
  return getEncryptionKey().keyId
}
