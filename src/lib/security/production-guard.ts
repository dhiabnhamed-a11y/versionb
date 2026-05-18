import { getConfiguredSuperAdminEmails } from '@/lib/security'
import { isProductionRuntime, requireEnv } from '@/lib/security/config'

export function assertProductionSecurityConfig() {
  if (!isProductionRuntime()) return

  requireEnv('AUTH_SECRET')
  requireEnv('DATABASE_URL')
  requireEnv('REDIS_URL')

  if (getConfiguredSuperAdminEmails().length === 0) {
    throw new Error('SUPER_ADMIN_EMAILS must be configured in production.')
  }

  if (!process.env.LEGAL_CONSENT_SIGNING_SECRET?.trim()) {
    throw new Error('LEGAL_CONSENT_SIGNING_SECRET must be configured in production.')
  }

  if (!process.env.REALTIME_HEALTH_TOKEN?.trim()) {
    throw new Error('REALTIME_HEALTH_TOKEN must be configured in production.')
  }

  if (!(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL)?.trim()) {
    throw new Error('NEXT_PUBLIC_APP_URL or APP_URL must be configured in production.')
  }
}
