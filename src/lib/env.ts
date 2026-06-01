import { logger } from '../modules/shared/logger'

let hasLoggedMissingAuthSecret = false

function cleanEnv(value: string | undefined) {
  const cleaned = value?.trim()
  return cleaned || undefined
}

export function getAuthSecret(context = 'auth') {
  const secret = cleanEnv(process.env.AUTH_SECRET) || cleanEnv(process.env.NEXTAUTH_SECRET)
  if (!secret && !hasLoggedMissingAuthSecret) {
    hasLoggedMissingAuthSecret = true
    logger.error('auth.secret_missing', undefined, { context })
  }

  return secret
}

const REQUIRED_ENV_VARS = ['DATABASE_URL', 'AUTH_SECRET'] as const
const CONDITIONAL_ENV_VARS: Array<{ key: string; condition: () => boolean; hint: string }> = [
  {
    key: 'DODO_PAYMENTS_WEBHOOK_KEY',
    condition: () => process.env.DODO_PAYMENTS_API_KEY !== undefined,
    hint: 'Required when DODO_PAYMENTS_API_KEY is set',
  },
]

let envValidated = false

export function validateEnv() {
  if (envValidated) return
  envValidated = true

  const missing: string[] = []

  for (const key of REQUIRED_ENV_VARS) {
    if (!cleanEnv(process.env[key])) missing.push(key)
  }

  // AUTH_SECRET can also be NEXTAUTH_SECRET
  if (missing.includes('AUTH_SECRET') && cleanEnv(process.env.NEXTAUTH_SECRET)) {
    missing.splice(missing.indexOf('AUTH_SECRET'), 1)
  }

  for (const { key, condition, hint } of CONDITIONAL_ENV_VARS) {
    if (condition() && !cleanEnv(process.env[key])) {
      logger.warn('env.conditional_missing', { key, hint })
    }
  }

  if (missing.length > 0) {
    const msg = `Missing required environment variables: ${missing.join(', ')}`
    logger.error('env.startup_validation_failed', undefined, { missing })
    if (process.env.NODE_ENV === 'production') {
      throw new Error(msg)
    }
  }
}
