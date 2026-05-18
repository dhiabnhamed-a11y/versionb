import type { RateLimitOptions } from '@/modules/shared/rate-limit'

export const API_RATE_LIMITS = {
  read: { namespace: 'api:read', max: 120, windowMs: 60_000 } satisfies RateLimitOptions,
  write: { namespace: 'api:write', max: 40, windowMs: 60_000 } satisfies RateLimitOptions,
  auth: { namespace: 'api:auth', max: 20, windowMs: 60_000 } satisfies RateLimitOptions,
  ai: { namespace: 'api:ai', max: 30, windowMs: 60_000 } satisfies RateLimitOptions,
  portal: { namespace: 'api:portal', max: 60, windowMs: 60_000 } satisfies RateLimitOptions,
  upload: { namespace: 'api:upload', max: 20, windowMs: 60_000 } satisfies RateLimitOptions,
} as const

export const DEFAULT_PROTECTED_ROUTE_LIMIT = API_RATE_LIMITS.read
