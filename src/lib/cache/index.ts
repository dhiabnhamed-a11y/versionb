import { getSharedRedis } from '@/lib/infra/redis-shared'

type CacheEntry<T> = { value: T; expiresAt: number }

const memory = new Map<string, CacheEntry<unknown>>()
const MAX_MEMORY_ENTRIES = 2_000

function getRedis() {
  return getSharedRedis()
}

function pruneMemory() {
  if (memory.size <= MAX_MEMORY_ENTRIES) return
  const now = Date.now()
  for (const [key, entry] of memory) {
    if (entry.expiresAt <= now) memory.delete(key)
    if (memory.size <= MAX_MEMORY_ENTRIES * 0.8) break
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedis()
  if (client) {
    try {
      const raw = await client.get(`cache:${key}`)
      if (raw) return JSON.parse(raw) as T
    } catch {
      /* fallback to memory */
    }
  }

  const entry = memory.get(key)
  if (!entry || entry.expiresAt <= Date.now()) {
    memory.delete(key)
    return null
  }
  return entry.value as T
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number) {
  const ttlMs = Math.max(ttlSeconds, 1) * 1000
  const client = getRedis()
  if (client) {
    try {
      await client.set(`cache:${key}`, JSON.stringify(value), 'PX', ttlMs)
      return
    } catch {
      /* fallback */
    }
  }

  pruneMemory()
  memory.set(key, { value, expiresAt: Date.now() + ttlMs })
}

export async function cacheDel(key: string) {
  const client = getRedis()
  if (client) {
    try {
      await client.del(`cache:${key}`)
    } catch {
      /* ignore */
    }
  }
  memory.delete(key)
}

export async function cached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const hit = await cacheGet<T>(key)
  if (hit !== null) return hit
  const value = await fn()
  await cacheSet(key, value, ttlSeconds)
  return value
}
