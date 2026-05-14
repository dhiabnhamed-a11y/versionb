export type RateLimitOptions = {
  namespace: string
  windowMs: number
  max: number
  key?: string
}

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfterSeconds: number
}

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

function getClientIp(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return (
    req.headers.get('cf-connecting-ip')?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    forwarded ||
    'unknown'
  )
}

function pruneExpiredBuckets(now: number) {
  if (buckets.size < 1000) return

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export function rateLimitRequest(req: Request, options: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  pruneExpiredBuckets(now)

  const key = `${options.namespace}:${options.key || getClientIp(req)}`
  const existing = buckets.get(key)
  const bucket = existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + options.windowMs }

  bucket.count += 1
  buckets.set(key, bucket)

  const remaining = Math.max(options.max - bucket.count, 0)
  const retryAfterSeconds = Math.max(Math.ceil((bucket.resetAt - now) / 1000), 1)

  return {
    allowed: bucket.count <= options.max,
    remaining,
    resetAt: bucket.resetAt,
    retryAfterSeconds,
  }
}
