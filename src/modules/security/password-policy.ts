import { createHash } from 'crypto'
import { badRequest } from '@/modules/shared/errors'

const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  '123456',
  '12345678',
  '123456789',
  'qwerty',
  'admin',
  'letmein',
  'welcome',
  'iloveyou',
  'taskit',
  'taskit123',
])

export type PasswordPolicyResult = {
  ok: boolean
  errors: string[]
  sha1: string
}

function configuredBreachedHashes() {
  return new Set(
    (process.env.BREACHED_PASSWORD_SHA1_HASHES ?? '')
      .split(',')
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean)
  )
}

export function passwordSha1(password: string) {
  return createHash('sha1').update(password).digest('hex').toUpperCase()
}

export function evaluatePasswordPolicy(password: string, identity: { email?: string; name?: string } = {}): PasswordPolicyResult {
  const errors: string[] = []
  const normalized = password.toLowerCase()
  const emailLocal = identity.email?.split('@')[0]?.toLowerCase()
  const nameParts = identity.name?.toLowerCase().split(/\s+/).filter((part) => part.length >= 3) ?? []
  const sha1 = passwordSha1(password)

  if (password.length < 12) errors.push('Password must be at least 12 characters.')
  if (!/[a-z]/.test(password)) errors.push('Password must include a lowercase letter.')
  if (!/[A-Z]/.test(password)) errors.push('Password must include an uppercase letter.')
  if (!/[0-9]/.test(password)) errors.push('Password must include a number.')
  if (!/[^a-zA-Z0-9]/.test(password)) errors.push('Password must include a symbol.')
  if (COMMON_PASSWORDS.has(normalized)) errors.push('Password appears in the common password blocklist.')
  if (emailLocal && emailLocal.length >= 3 && normalized.includes(emailLocal)) {
    errors.push('Password must not contain your email name.')
  }
  if (nameParts.some((part) => normalized.includes(part))) {
    errors.push('Password must not contain your name.')
  }
  if (configuredBreachedHashes().has(sha1)) {
    errors.push('Password appears in the configured breached-password blocklist.')
  }

  return { ok: errors.length === 0, errors, sha1 }
}

export function assertPasswordPolicy(password: string, identity: { email?: string; name?: string } = {}) {
  const result = evaluatePasswordPolicy(password, identity)
  if (!result.ok) {
    throw badRequest('Password does not meet security requirements.', { password: result.errors })
  }

  return result
}
