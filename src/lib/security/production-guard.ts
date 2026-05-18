import { getConfiguredSuperAdminEmails } from '@/lib/security'
import { isProductionRuntime, requireEnv } from '@/lib/security/config'
import { logger } from '@/modules/shared/logger'

function warnMissingEnv(name: string, hint: string) {
  logger.warn('production.env_optional_missing', { name, hint })
}

export function assertProductionSecurityConfig() {
  if (!isProductionRuntime()) return

  requireEnv('AUTH_SECRET')
  requireEnv('DATABASE_URL')

  if (!(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL)?.trim()) {
    throw new Error('NEXT_PUBLIC_APP_URL or APP_URL must be configured in production.')
  }

  if (getConfiguredSuperAdminEmails().length === 0) {
    throw new Error('SUPER_ADMIN_EMAILS must be configured in production.')
  }

  if (!process.env.LEGAL_CONSENT_SIGNING_SECRET?.trim()) {
    throw new Error('LEGAL_CONSENT_SIGNING_SECRET must be configured in production.')
  }

  if (!process.env.REDIS_URL?.trim() && !process.env.QUEUE_REDIS_URL?.trim() && !process.env.REALTIME_REDIS_URL?.trim()) {
    warnMissingEnv(
      'REDIS_URL',
      'Distributed rate limiting and realtime features fall back to in-memory mode without Redis.'
    )
  }

  if (!process.env.REALTIME_HEALTH_TOKEN?.trim()) {
    warnMissingEnv('REALTIME_HEALTH_TOKEN', 'The /api/realtime/health endpoint stays unprotected without this token.')
  }
}
