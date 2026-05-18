import { NextResponse } from 'next/server'
import { NO_STORE_HEADERS } from '@/lib/http'
import { DEFAULT_API_TIMEOUT_MS, withTimeout } from '@/lib/request-timeout'
import { enforceDistributedRateLimit } from '@/lib/rate-limit'
import { recordSecurityAudit } from '@/modules/security/audit'
import { logger } from '@/modules/shared/logger'
import { normalizeError, type ApiErrorPayload } from '@/modules/shared/errors'
import type { RateLimitOptions, RateLimitResult } from '@/modules/shared/rate-limit'

export const REQUEST_ID_HEADER = 'X-Request-Id'

export type ApiRequestContext = {
  requestId: string
}

type WithApiErrorOptions = {
  route?: string
  rateLimit?: RateLimitOptions
  timeoutMs?: number
}

export function okJson<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...NO_STORE_HEADERS,
      ...(init?.headers ?? {}),
    },
  })
}

function createRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function isSafeRequestId(value: string | null) {
  return Boolean(value && value.length <= 128 && /^[a-zA-Z0-9._:-]+$/.test(value))
}

export function getRequestId(req?: Request) {
  const incoming = req?.headers.get(REQUEST_ID_HEADER) ?? req?.headers.get('x-correlation-id') ?? null
  return isSafeRequestId(incoming) ? incoming! : createRequestId()
}

function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': new Date(result.resetAt).toISOString(),
    ...(result.allowed ? {} : { 'Retry-After': String(result.retryAfterSeconds) }),
  }
}

function applyResponseHeaders(response: Response, headers: HeadersInit) {
  try {
    const nextHeaders = new Headers(headers)
    nextHeaders.forEach((value, key) => response.headers.set(key, value))
    return response
  } catch {
    const nextHeaders = new Headers(response.headers)
    new Headers(headers).forEach((value, key) => nextHeaders.set(key, value))
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: nextHeaders,
    })
  }
}

function getClientIp(req?: Request) {
  if (!req) return null
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return req.headers.get('cf-connecting-ip')?.trim() || req.headers.get('x-real-ip')?.trim() || forwarded || null
}

export async function withApiError(handler: (context: ApiRequestContext) => Promise<Response>): Promise<Response>
export async function withApiError(
  req: Request,
  handler: (context: ApiRequestContext) => Promise<Response>,
  options?: WithApiErrorOptions
): Promise<Response>
export async function withApiError(
  reqOrHandler: Request | ((context: ApiRequestContext) => Promise<Response>),
  maybeHandler?: (context: ApiRequestContext) => Promise<Response>,
  options: WithApiErrorOptions = {}
) {
  const req = typeof reqOrHandler === 'function' ? undefined : reqOrHandler
  const handler = typeof reqOrHandler === 'function' ? reqOrHandler : maybeHandler
  if (!handler) throw new Error('withApiError requires a handler.')

  const requestId = getRequestId(req)
  const route = options.route || (req ? new URL(req.url).pathname : undefined)
  let extraHeaders: HeadersInit = { [REQUEST_ID_HEADER]: requestId }

  if (req && options.rateLimit) {
    const rateLimit = await enforceDistributedRateLimit(req, options.rateLimit)
    extraHeaders = { ...extraHeaders, ...rateLimitHeaders(rateLimit) }

    if (!rateLimit.allowed) {
      logger.warn('api.rate_limited', { requestId, route, namespace: options.rateLimit.namespace })
      await recordSecurityAudit({
        action: 'api.rate_limited',
        entityId: route,
        entityType: 'api_route',
        ipAddress: getClientIp(req),
        metadata: { namespace: options.rateLimit.namespace },
        requestId,
        userAgent: req.headers.get('user-agent'),
      })
      const payload: ApiErrorPayload = {
        error: 'Too many requests. Please try again shortly.',
        code: 'RATE_LIMITED',
        requestId,
      }

      return NextResponse.json(payload, {
        status: 429,
        headers: {
          ...NO_STORE_HEADERS,
          ...extraHeaders,
        },
      })
    }
  }

  try {
    const response = await withTimeout(handler({ requestId }), options.timeoutMs ?? DEFAULT_API_TIMEOUT_MS)
    return applyResponseHeaders(response, extraHeaders)
  } catch (error) {
    if (error instanceof Error && error.message === 'REQUEST_TIMEOUT') {
      return NextResponse.json(
        { error: 'Request timed out', code: 'TIMEOUT', requestId },
        { status: 504, headers: { ...NO_STORE_HEADERS, ...extraHeaders } }
      )
    }
    const normalized = normalizeError(error)
    if (normalized.status >= 500) {
      logger.error('api.unhandled_error', error, { code: normalized.code, requestId, route })
    }
    if (normalized.status === 401 || normalized.status === 403) {
      await recordSecurityAudit({
        action: normalized.status === 401 ? 'api.unauthorized' : 'api.forbidden',
        entityId: route,
        entityType: 'api_route',
        ipAddress: getClientIp(req),
        metadata: { code: normalized.code },
        requestId,
        userAgent: req?.headers.get('user-agent') ?? null,
      })
    }

    const payload: ApiErrorPayload = {
      error: normalized.expose ? normalized.message : 'Server error',
      code: normalized.code,
      details: normalized.expose ? normalized.details : undefined,
      requestId,
    }

    return NextResponse.json(payload, {
      status: normalized.status,
      headers: {
        ...NO_STORE_HEADERS,
        ...extraHeaders,
      },
    })
  }
}

export async function parseJsonObject(req: Request) {
  const body = await req.json().catch(() => ({}))
  return body && typeof body === 'object' ? body : {}
}
