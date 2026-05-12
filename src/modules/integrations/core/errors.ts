import { AppError } from '@/modules/shared/errors'
import type { SocialProviderSlug } from '@/modules/integrations/core/types'

export type ProviderErrorReason =
  | 'CONFIGURATION_MISSING'
  | 'CAPABILITY_UNAVAILABLE'
  | 'OAUTH_EXCHANGE_FAILED'
  | 'TOKEN_REFRESH_FAILED'
  | 'TOKEN_REVOKE_FAILED'
  | 'PROFILE_FETCH_FAILED'
  | 'ANALYTICS_FETCH_FAILED'
  | 'REVENUE_FETCH_FAILED'
  | 'CONTENT_FETCH_FAILED'
  | 'RATE_LIMITED'
  | 'PROVIDER_UNAVAILABLE'

export class ProviderError extends AppError {
  provider: SocialProviderSlug
  reason: ProviderErrorReason

  constructor(provider: SocialProviderSlug, reason: ProviderErrorReason, message: string, details?: unknown, status = 502) {
    super(message, { status, code: `SOCIAL_${reason}`, details, expose: status < 500 || reason === 'CONFIGURATION_MISSING' })
    this.name = 'ProviderError'
    this.provider = provider
    this.reason = reason
  }
}

export function configurationMissing(provider: SocialProviderSlug, key: string) {
  return new ProviderError(provider, 'CONFIGURATION_MISSING', `${provider} integration is missing ${key}.`, { key }, 503)
}

export function capabilityUnavailable(provider: SocialProviderSlug, capability: string, details?: unknown) {
  return new ProviderError(provider, 'CAPABILITY_UNAVAILABLE', `${provider} does not expose ${capability} through the configured API.`, details, 409)
}
