import { NextResponse } from 'next/server'
import { assertSafeApiOrigin, defaultRateLimitForRequest } from '@/lib/security/request-guard'
import { enforceDistributedRateLimit } from '@/lib/rate-limit'
import { NO_STORE_HEADERS } from '@/lib/http'
import { requireSessionUser } from '@/modules/shared/session'

export async function withLegacyApiGuard(req: Request, handler: (user: Awaited<ReturnType<typeof requireSessionUser>>) => Promise<Response>) {
  assertSafeApiOrigin(req)
  const rate = await enforceDistributedRateLimit(req, defaultRateLimitForRequest(req))
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: NO_STORE_HEADERS })
  }
  const user = await requireSessionUser()
  return handler(user)
}
