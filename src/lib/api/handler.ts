import type { NextRequest } from 'next/server'
import { forbidden, normalizeError } from '@/lib/api/errors'
import { REQUEST_ID_HEADER, getRequestId } from '@/lib/api/request-id'
import { apiError, apiOk, legacyJson } from '@/lib/api/response'
import { requireSessionUser, type SessionUser } from '@/lib/api/auth'
import type { ApiPagination, ApiRequestContext, ApiResponseMode } from '@/lib/api/types'
import { logger } from '@/modules/shared/logger'
import { rateLimitRequest, type RateLimitOptions, type RateLimitResult } from '@/modules/shared/rate-limit'

const API_ROUTE_RESULT = Symbol('API_ROUTE_RESULT')

export type ApiParams = Record<string, string | string[] | undefined>

export type ApiRouteContext<TParams extends ApiParams = ApiParams> = {
  params?: Promise<TParams> | TParams
}

export type ApiRouteDataOptions = {
  code?: string
  headers?: HeadersInit
  pagination?: ApiPagination
  responseMode?: ApiResponseMode
  status?: number
}

export type ApiRouteDataResult<TData> = {
  readonly [API_ROUTE_RESULT]: true
  data: TData
  options: ApiRouteDataOptions
}

export type ApiRouteResult<TData> = Response | ApiRouteDataResult<TData> | TData

export type ApiHandlerContext<TParams extends ApiParams = ApiParams> = ApiRequestContext & {
  params: TParams
  req: NextRequest
  route: string
  user?: SessionUser
}

export type AuthenticatedApiHandlerContext<TParams extends ApiParams = ApiParams> = Omit<ApiHandlerContext<TParams>, 'user'> & {
  user: SessionUser
}

export type ApiRouteOptions<TParams extends ApiParams = ApiParams> = {
  auth?: 'none' | 'required'
  permission?: (context: AuthenticatedApiHandlerContext<TParams>) => boolean | void | Promise<boolean | void>
  rateLimit?: RateLimitOptions
  responseMode?: ApiResponseMode
  route?: string
}

type ApiHandler<TParams extends ApiParams, TData> = (context: ApiHandlerContext<TParams>) => Promise<ApiRouteResult<TData>> | ApiRouteResult<TData>
type AuthenticatedApiHandler<TParams extends ApiParams, TData> = (
  context: AuthenticatedApiHandlerContext<TParams>
) => Promise<ApiRouteResult<TData>> | ApiRouteResult<TData>

type ApplyHeadersInput = {
  requestId: string
  rateLimit?: RateLimitResult
}

export function apiData<TData>(data: TData, options: ApiRouteDataOptions = {}): ApiRouteDataResult<TData> {
  return {
    [API_ROUTE_RESULT]: true,
    data,
    options,
  }
}

function isApiRouteDataResult<TData>(value: unknown): value is ApiRouteDataResult<TData> {
  return Boolean(value && typeof value === 'object' && API_ROUTE_RESULT in value)
}

function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': new Date(result.resetAt).toISOString(),
    ...(result.allowed ? {} : { 'Retry-After': String(result.retryAfterSeconds) }),
  }
}

function buildTraceHeaders(input: ApplyHeadersInput): HeadersInit {
  return {
    [REQUEST_ID_HEADER]: input.requestId,
    ...(input.rateLimit ? rateLimitHeaders(input.rateLimit) : {}),
  }
}

function applyResponseHeaders(response: Response, headers: HeadersInit) {
  try {
    new Headers(headers).forEach((value, key) => response.headers.set(key, value))
    return response
  } catch {
    const nextHeaders = new Headers(response.headers)
    new Headers(headers).forEach((value, key) => nextHeaders.set(key, value))
    return new Response(response.body, {
      headers: nextHeaders,
      status: response.status,
      statusText: response.statusText,
    })
  }
}

async function resolveParams<TParams extends ApiParams>(context?: ApiRouteContext<TParams>) {
  return (await Promise.resolve(context?.params ?? ({} as TParams))) as TParams
}

function getRoute(req: NextRequest, route?: string) {
  if (route) return route
  return new URL(req.url).pathname
}

function toResponse<TData>(result: ApiRouteResult<TData>, requestId: string, defaultMode: ApiResponseMode) {
  if (result instanceof Response) return result

  const dataResult = isApiRouteDataResult<TData>(result) ? result : apiData(result)
  const mode = dataResult.options.responseMode ?? defaultMode

  if (mode === 'canonical') {
    return apiOk(dataResult.data, {
      code: dataResult.options.code,
      headers: dataResult.options.headers,
      pagination: dataResult.options.pagination,
      requestId,
      status: dataResult.options.status,
    })
  }

  return legacyJson(dataResult.data, {
    headers: dataResult.options.headers,
    requestId,
    status: dataResult.options.status,
  })
}

function errorResponse(error: unknown, requestId: string, mode: ApiResponseMode) {
  const normalized = normalizeError(error)
  const message = normalized.expose ? normalized.message : 'Server error'
  const details = normalized.expose ? normalized.details : undefined

  if (mode === 'canonical') {
    return apiError(message, {
      code: normalized.code,
      details,
      requestId,
      status: normalized.status,
    })
  }

  return legacyJson(
    {
      error: message,
      code: normalized.code,
      details,
      requestId,
    },
    {
      requestId,
      status: normalized.status,
    }
  )
}

export async function handleApiRoute<TParams extends ApiParams = ApiParams, TData = unknown>(
  req: NextRequest,
  context: ApiRouteContext<TParams> | undefined,
  handler: AuthenticatedApiHandler<TParams, TData>,
  options: ApiRouteOptions<TParams> & { auth: 'required' }
): Promise<Response>
export async function handleApiRoute<TParams extends ApiParams = ApiParams, TData = unknown>(
  req: NextRequest,
  context: ApiRouteContext<TParams> | undefined,
  handler: ApiHandler<TParams, TData>,
  options?: ApiRouteOptions<TParams>
): Promise<Response>
export async function handleApiRoute<TParams extends ApiParams = ApiParams, TData = unknown>(
  req: NextRequest,
  context: ApiRouteContext<TParams> | undefined,
  handler: ApiHandler<TParams, TData> | AuthenticatedApiHandler<TParams, TData>,
  options: ApiRouteOptions<TParams> = {}
) {
  const requestId = getRequestId(req)
  const route = getRoute(req, options.route)
  const responseMode = options.responseMode ?? 'legacy'
  let rateLimit: RateLimitResult | undefined

  if (options.rateLimit) {
    rateLimit = rateLimitRequest(req, options.rateLimit)
    if (!rateLimit.allowed) {
      logger.warn('api.rate_limited', { requestId, route, namespace: options.rateLimit.namespace })
      return applyResponseHeaders(
        errorResponse(
          {
            code: 'RATE_LIMITED',
            expose: true,
            message: 'Too many requests. Please try again shortly.',
            status: 429,
          },
          requestId,
          responseMode
        ),
        buildTraceHeaders({ rateLimit, requestId })
      )
    }
  }

  try {
    const params = await resolveParams(context)
    const baseContext: ApiHandlerContext<TParams> = { params, req, requestId, route }
    const shouldRequireAuth = options.auth === 'required' || Boolean(options.permission)
    const user = shouldRequireAuth ? await requireSessionUser() : undefined
    const nextContext = user ? { ...baseContext, user } : baseContext

    if (options.permission) {
      const allowed = await options.permission(nextContext as AuthenticatedApiHandlerContext<TParams>)
      if (allowed === false) throw forbidden()
    }

    const response = await handler(nextContext as AuthenticatedApiHandlerContext<TParams> & ApiHandlerContext<TParams>)
    return applyResponseHeaders(toResponse(response, requestId, responseMode), buildTraceHeaders({ rateLimit, requestId }))
  } catch (error) {
    const normalized = normalizeError(error)
    if (normalized.status >= 500) {
      logger.error('api.unhandled_error', error, { code: normalized.code, requestId, route })
    }

    return applyResponseHeaders(errorResponse(normalized, requestId, responseMode), buildTraceHeaders({ rateLimit, requestId }))
  }
}

export function apiRoute<TParams extends ApiParams = ApiParams, TData = unknown>(
  handler: AuthenticatedApiHandler<TParams, TData>,
  options: ApiRouteOptions<TParams> & { auth: 'required' }
) {
  return (req: NextRequest, context?: ApiRouteContext<TParams>) => handleApiRoute(req, context, handler, options)
}
