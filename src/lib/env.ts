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
