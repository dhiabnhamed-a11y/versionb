import { ProviderError } from '@/modules/integrations/core/errors'
import type { ProviderRequestContext, SocialProviderSlug } from '@/modules/integrations/core/types'
import { getIntegrationRedis } from '@/modules/integrations/cache/redis'

type LimitPolicy = {
  windowSeconds: number
  maxRequests: number
  cooldownSeconds: number
}

const PROVIDER_LIMITS: Record<SocialProviderSlug, LimitPolicy> = {
  youtube: { windowSeconds: 60, maxRequests: 450, cooldownSeconds: 60 },
  spotify: { windowSeconds: 30, maxRequests: 120, cooldownSeconds: 30 },
  tiktok: { windowSeconds: 60, maxRequests: 120, cooldownSeconds: 60 },
  instagram: { windowSeconds: 60, maxRequests: 180, cooldownSeconds: 60 },
  facebook: { windowSeconds: 60, maxRequests: 180, cooldownSeconds: 60 },
  twitter: { windowSeconds: 15 * 60, maxRequests: 280, cooldownSeconds: 15 * 60 },
  twitch: { windowSeconds: 60, maxRequests: 700, cooldownSeconds: 60 },
  linkedin: { windowSeconds: 60, maxRequests: 100, cooldownSeconds: 60 },
}

const memoryCounters = new Map<string, { count: number; expiresAt: number }>()
const memoryCooldowns = new Map<string, number>()

function keyFor(provider: SocialProviderSlug, companyId: string) {
  return `taskit:social:rate:${provider}:${companyId}`
}

function cooldownKey(provider: SocialProviderSlug, companyId: string) {
  return `taskit:social:cooldown:${provider}:${companyId}`
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function memoryAcquire(provider: SocialProviderSlug, companyId: string, weight: number, policy: LimitPolicy) {
  const now = Date.now()
  const cooldownUntil = memoryCooldowns.get(cooldownKey(provider, companyId)) ?? 0
  if (cooldownUntil > now) throw new ProviderError(provider, 'RATE_LIMITED', `${provider} is cooling down.`, { retryAfterMs: cooldownUntil - now }, 429)

  const counterKey = keyFor(provider, companyId)
  const existing = memoryCounters.get(counterKey)
  const counter = !existing || existing.expiresAt <= now ? { count: 0, expiresAt: now + policy.windowSeconds * 1000 } : existing
  counter.count += weight
  memoryCounters.set(counterKey, counter)
  if (counter.count > policy.maxRequests) {
    memoryCooldowns.set(cooldownKey(provider, companyId), now + policy.cooldownSeconds * 1000)
    throw new ProviderError(provider, 'RATE_LIMITED', `${provider} API quota is temporarily exhausted.`, { retryAfterMs: policy.cooldownSeconds * 1000 }, 429)
  }
}

export async function acquireProviderRateLimit(context: ProviderRequestContext, weight = 1) {
  const policy = PROVIDER_LIMITS[context.providerSlug]
  const redis = getIntegrationRedis()

  if (!redis) {
    await memoryAcquire(context.providerSlug, context.companyId, weight, policy)
    return
  }

  const cooldown = await redis.get(cooldownKey(context.providerSlug, context.companyId))
  if (cooldown) {
    throw new ProviderError(context.providerSlug, 'RATE_LIMITED', `${context.providerSlug} is cooling down.`, { retryAfterMs: Number(cooldown) }, 429)
  }

  const key = keyFor(context.providerSlug, context.companyId)
  const count = await redis.incrby(key, weight)
  if (count === weight) await redis.expire(key, policy.windowSeconds)

  if (count > policy.maxRequests) {
    await redis.set(cooldownKey(context.providerSlug, context.companyId), String(policy.cooldownSeconds * 1000), 'EX', policy.cooldownSeconds)
    throw new ProviderError(context.providerSlug, 'RATE_LIMITED', `${context.providerSlug} API quota is temporarily exhausted.`, { retryAfterMs: policy.cooldownSeconds * 1000 }, 429)
  }
}

export async function recordProviderCooldown(provider: SocialProviderSlug, companyId: string, retryAfterSeconds: number) {
  const retryAfter = Math.max(retryAfterSeconds, PROVIDER_LIMITS[provider].cooldownSeconds)
  const redis = getIntegrationRedis()
  if (redis) {
    await redis.set(cooldownKey(provider, companyId), String(retryAfter * 1000), 'EX', retryAfter)
  } else {
    memoryCooldowns.set(cooldownKey(provider, companyId), Date.now() + retryAfter * 1000)
  }
}

export async function waitForProviderSlot(context: ProviderRequestContext, weight = 1) {
  try {
    await acquireProviderRateLimit(context, weight)
  } catch (error) {
    if (error instanceof ProviderError && error.reason === 'RATE_LIMITED') {
      const retryAfterMs =
        error.details && typeof error.details === 'object' && 'retryAfterMs' in error.details
          ? Number((error.details as { retryAfterMs?: unknown }).retryAfterMs)
          : 1000
      await delay(Math.min(Math.max(retryAfterMs, 250), 5_000))
      await acquireProviderRateLimit(context, weight)
      return
    }
    throw error
  }
}
