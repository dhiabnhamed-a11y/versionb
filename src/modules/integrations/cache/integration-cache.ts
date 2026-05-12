import { getIntegrationRedis } from '@/modules/integrations/cache/redis'
import { logger } from '@/modules/shared/logger'

type MemoryEntry = {
  value: string
  expiresAt: number
}

const memoryCache = new Map<string, MemoryEntry>()

function namespaced(key: string) {
  return `taskit:social:${key}`
}

function pruneMemory() {
  const now = Date.now()
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.expiresAt <= now) memoryCache.delete(key)
  }
}

export async function getCachedJson<T>(key: string): Promise<T | null> {
  const redis = getIntegrationRedis()
  const cacheKey = namespaced(key)

  if (redis) {
    try {
      const value = await redis.get(cacheKey)
      return value ? (JSON.parse(value) as T) : null
    } catch (error) {
      logger.warn('integrations.cache_get_failed', { key, error: error instanceof Error ? error.message : String(error) })
    }
  }

  pruneMemory()
  const entry = memoryCache.get(cacheKey)
  if (!entry || entry.expiresAt <= Date.now()) return null
  return JSON.parse(entry.value) as T
}

export async function setCachedJson(key: string, value: unknown, ttlSeconds: number) {
  const redis = getIntegrationRedis()
  const cacheKey = namespaced(key)
  const serialized = JSON.stringify(value)

  if (redis) {
    try {
      await redis.set(cacheKey, serialized, 'EX', ttlSeconds)
      return
    } catch (error) {
      logger.warn('integrations.cache_set_failed', { key, error: error instanceof Error ? error.message : String(error) })
    }
  }

  memoryCache.set(cacheKey, { value: serialized, expiresAt: Date.now() + ttlSeconds * 1000 })
}

export async function deleteCached(key: string) {
  const redis = getIntegrationRedis()
  const cacheKey = namespaced(key)

  if (redis) {
    try {
      await redis.del(cacheKey)
    } catch (error) {
      logger.warn('integrations.cache_delete_failed', { key, error: error instanceof Error ? error.message : String(error) })
    }
  }

  memoryCache.delete(cacheKey)
}
