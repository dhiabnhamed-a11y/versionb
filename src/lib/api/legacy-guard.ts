import { NextResponse } from 'next/server'
import { getRequestId } from '@/lib/api/request-id'
import { assertSafeApiOrigin, defaultRateLimitForRequest } from '@/lib/security/request-guard'
import { enforceDistributedRateLimit } from '@/lib/rate-limit'
import { NO_STORE_HEADERS } from '@/lib/http'
import { normalizeError } from '@/modules/shared/errors'
import { logger } from '@/modules/shared/logger'
import { requireSessionUser } from '@/modules/shared/session'

export async function withLegacyApiGuard(req: Request, handler: (user: Awaited<ReturnType<typeof requireSessionUser>>) => Promise<Response>) {
  const requestId = getRequestId(req)

  try {
    assertSafeApiOrigin(req)
    const rate = await enforceDistributedRateLimit(req, defaultRateLimitForRequest(req))
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many requests', code: 'RATE_LIMITED', requestId },
        { status: 429, headers: NO_STORE_HEADERS }
      )
    }
    const user = await requireSessionUser(req)
    return await handler(user)
  } catch (error) {
    const normalized = normalizeError(error)
    if (normalized.status >= 500) {
      logger.error('api.legacy_unhandled_error', error, { code: normalized.code, requestId, route: new URL(req.url).pathname })
    }
    return NextResponse.json(
      {
        error: normalized.expose ? normalized.message : 'Server error',
        code: normalized.code,
        requestId,
      },
      { status: normalized.status, headers: NO_STORE_HEADERS }
    )
  }
}
