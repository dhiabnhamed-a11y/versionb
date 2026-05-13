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

function cleanSecret(value?: string | null) {
  return value?.trim().replace(/^['"]|['"]$/g, '') || null
}

function getAuthDerivedSecret() {
  const secret = cleanSecret(process.env.AUTH_SECRET) || cleanSecret(process.env.NEXTAUTH_SECRET)
  if (!secret) {
    logger.error('integrations.token_crypto_missing_key_material')
    throw new Error('SOCIAL_TOKEN_ENCRYPTION_KEY, AUTH_SECRET, or NEXTAUTH_SECRET must be set before encrypting social tokens.')
  }

  return secret
}

function deriveAuthSecretKey() {
  const secret = getAuthDerivedSecret()
  logger.warn('integrations.token_crypto_using_auth_secret_derived_key')
  return createHash('sha256').update(secret).digest()
}

function getEncryptionKey() {
  const configured = cleanSecret(process.env.SOCIAL_TOKEN_ENCRYPTION_KEY)
  if (!configured) return { key: deriveAuthSecretKey(), keyId: 'auth-secret-derived' }

  const key = Buffer.from(configured, 'base64')
  if (key.length !== 32) {
    logger.warn('integrations.token_crypto_invalid_configured_key_falling_back', {
      keyId: process.env.SOCIAL_TOKEN_ENCRYPTION_KEY_ID || 'primary',
    })
    return { key: deriveAuthSecretKey(), keyId: 'auth-secret-derived' }
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
