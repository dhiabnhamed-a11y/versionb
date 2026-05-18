import type { NextRequest } from 'next/server'
import { forbidden, normalizeError } from '@/lib/api/errors'
import { REQUEST_ID_HEADER, getRequestId } from '@/lib/api/request-id'
import { apiError, apiOk, legacyJson } from '@/lib/api/response'
import { requireSessionUser, type SessionUser } from '@/lib/api/auth'
import type { ApiMeta, ApiPagination, ApiRequestContext, ApiResponseMode } from '@/lib/api/types'
import { getIdempotencyKey, runIdempotent } from '@/lib/idempotency'
import { assertSafeApiOrigin, defaultRateLimitForRequest } from '@/lib/security/request-guard'
import { enforceDistributedRateLimit } from '@/lib/rate-limit'
import { requirePermission, requireRole } from '@/modules/security/access-control'
import { recordSecurityAudit } from '@/modules/security/audit'
import type { UserRole } from '@/lib/security'
import type { PermissionAction, PermissionResource, PermissionSubject } from '@/modules/permissions/permissions'
import { logger } from '@/modules/shared/logger'
import { runWithPrismaTenantContext } from '@/lib/tenant/prisma-context'
import type { RateLimitOptions, RateLimitResult } from '@/modules/shared/rate-limit'

const API_ROUTE_RESULT = Symbol('API_ROUTE_RESULT')

export type ApiParams = Record<string, string | string[] | undefined>

export type ApiRouteContext<TParams extends ApiParams = ApiParams> = {
  params?: Promise<TParams> | TParams
}

export type ApiRouteDataOptions = {
  code?: string
  headers?: HeadersInit
  meta?: ApiMeta
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

export type ApiIdempotencyOptions = {
  enabled?: boolean
  required?: boolean
  processingTtlMs?: number
  responseStatus?: number
  ttlMs?: number
  bodyMode?: 'json' | 'request'
}

export type ApiRouteOptions<TParams extends ApiParams = ApiParams> = {
  auth?: 'none' | 'required'
  idempotency?: ApiIdempotencyOptions | boolean
  permission?: (context: AuthenticatedApiHandlerContext<TParams>) => boolean | void | Promise<boolean | void>
  requiredPermission?: {
    action: PermissionAction
    subject: PermissionSubject
    resource?: PermissionResource | ((context: AuthenticatedApiHandlerContext<TParams>) => PermissionResource | undefined)
  }
  requiredRole?: UserRole | UserRole[]
  rateLimit?: RateLimitOptions
  responseMode?: ApiResponseMode
  route?: string
}

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function resolveIdempotencyOptions(value: ApiRouteOptions['idempotency']): ApiIdempotencyOptions | null {
  if (!value) return null
  if (value === true) return { enabled: true }
  return value.enabled === false ? null : value
}

type IdempotentStoredResult = {
  kind: 'data'
  data: unknown
  options: ApiRouteDataOptions
}

function serializeIdempotentResult<TData>(result: ApiRouteResult<TData>): IdempotentStoredResult {
  if (result instanceof Response) {
    throw {
      code: 'IDEMPOTENCY_UNSUPPORTED_RESPONSE',
      expose: false,
      message: 'Handlers using idempotency must return apiData(...) or plain data, not a Response.',
      status: 500,
    }
  }
  if (isApiRouteDataResult<TData>(result)) {
    return { kind: 'data', data: result.data, options: result.options }
  }
  return { kind: 'data', data: result, options: {} }
}

function deserializeIdempotentResult<TData>(stored: IdempotentStoredResult): ApiRouteDataResult<TData> {
  return apiData(stored.data as TData, stored.options ?? {})
}

async function readIdempotencyBody(req: NextRequest, mode: ApiIdempotencyOptions['bodyMode']) {
  if (mode === 'request') return null
  try {
    const cloned = req.clone()
    const text = await cloned.text()
    if (!text) return null
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  } catch {
    return null
  }
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

function getClientIp(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return req.headers.get('cf-connecting-ip')?.trim() || req.headers.get('x-real-ip')?.trim() || forwarded || null
}

function toResponse<TData>(result: ApiRouteResult<TData>, requestId: string, defaultMode: ApiResponseMode) {
  if (result instanceof Response) return result

  const dataResult = isApiRouteDataResult<TData>(result) ? result : apiData(result)
  const mode = dataResult.options.responseMode ?? defaultMode

  if (mode === 'canonical') {
    return apiOk(dataResult.data, {
      code: dataResult.options.code,
      headers: dataResult.options.headers,
      meta: dataResult.options.meta,
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
  const startedAt = Date.now()
  const route = getRoute(req, options.route)
  const responseMode = options.responseMode ?? 'legacy'
  let rateLimit: RateLimitResult | undefined

  try {
    assertSafeApiOrigin(req)
    const rateLimitPolicy = options.rateLimit ?? defaultRateLimitForRequest(req)
    rateLimit = await enforceDistributedRateLimit(req, rateLimitPolicy)
    if (!rateLimit.allowed) {
      logger.warn('api.rate_limited', { requestId, route, namespace: rateLimitPolicy.namespace })
      await recordSecurityAudit({
        action: 'api.rate_limited',
        entityId: route,
        entityType: 'api_route',
        ipAddress: getClientIp(req),
        metadata: { method: req.method, namespace: rateLimitPolicy.namespace },
        requestId,
        userAgent: req.headers.get('user-agent'),
      })
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

    const params = await resolveParams(context)
    const baseContext: ApiHandlerContext<TParams> = { params, req, requestId, route, startedAt }
    const shouldRequireAuth = options.auth === 'required' || Boolean(options.permission) || Boolean(options.requiredRole || options.requiredPermission)
    const user = shouldRequireAuth ? await requireSessionUser() : undefined
    const nextContext = user
      ? { ...baseContext, actorId: user.id, companyId: user.companyId ?? undefined, user }
      : baseContext

    if (options.requiredRole) {
      requireRole((nextContext as AuthenticatedApiHandlerContext<TParams>).user, options.requiredRole)
    }

    if (options.requiredPermission) {
      const permission = options.requiredPermission
      const authenticatedContext = nextContext as AuthenticatedApiHandlerContext<TParams>
      const resource = typeof permission.resource === 'function' ? permission.resource(authenticatedContext) : permission.resource
      requirePermission(authenticatedContext.user, permission.action, permission.subject, resource)
    }

    if (options.permission) {
      const allowed = await options.permission(nextContext as AuthenticatedApiHandlerContext<TParams>)
      if (allowed === false) throw forbidden()
    }

    const runHandler = () => {
      if (user) {
        return runWithPrismaTenantContext(user, () =>
          handler(nextContext as AuthenticatedApiHandlerContext<TParams> & ApiHandlerContext<TParams>)
        )
      }
      return handler(nextContext as AuthenticatedApiHandlerContext<TParams> & ApiHandlerContext<TParams>)
    }
    const idempotencyOptions = resolveIdempotencyOptions(options.idempotency)
    let response: ApiRouteResult<TData>

    if (idempotencyOptions && MUTATION_METHODS.has(req.method.toUpperCase())) {
      const key = getIdempotencyKey(req)
      if (!key) {
        if (idempotencyOptions.required) {
          throw {
            code: 'IDEMPOTENCY_KEY_REQUIRED',
            expose: true,
            message: 'Idempotency-Key header is required for this endpoint.',
            status: 400,
          }
        }
        response = await runHandler()
      } else {
        if (!user?.companyId) {
          throw {
            code: 'IDEMPOTENCY_REQUIRES_WORKSPACE',
            expose: true,
            message: 'A workspace is required to use Idempotency-Key.',
            status: 400,
          }
        }
        const body = await readIdempotencyBody(req, idempotencyOptions.bodyMode)
        const stored = (await runIdempotent(
          key,
          body,
          async () => serializeIdempotentResult(await runHandler()),
          {
            companyId: user.companyId,
            method: req.method,
            processingTtlMs: idempotencyOptions.processingTtlMs,
            responseStatus: idempotencyOptions.responseStatus,
            route,
            ttlMs: idempotencyOptions.ttlMs,
          }
        )) as IdempotentStoredResult
        response = deserializeIdempotentResult<TData>(stored)
      }
    } else {
      response = await runHandler()
    }
    const finalResponse = applyResponseHeaders(toResponse(response, requestId, responseMode), buildTraceHeaders({ rateLimit, requestId }))
    logger.info('api.request_completed', {
      companyId: user?.companyId,
      durationMs: Date.now() - startedAt,
      method: req.method,
      requestId,
      route,
      status: finalResponse.status,
      userId: user?.id,
    })
    return finalResponse
  } catch (error) {
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
        metadata: { code: normalized.code, method: req.method },
        requestId,
        userAgent: req.headers.get('user-agent'),
      })
    }

    const finalResponse = applyResponseHeaders(errorResponse(normalized, requestId, responseMode), buildTraceHeaders({ rateLimit, requestId }))
    logger.info('api.request_completed', {
      code: normalized.code,
      durationMs: Date.now() - startedAt,
      method: req.method,
      requestId,
      route,
      status: finalResponse.status,
    })
    return finalResponse
  }
}

export function apiRoute<TParams extends ApiParams = ApiParams, TData = unknown>(
  handler: AuthenticatedApiHandler<TParams, TData>,
  options: ApiRouteOptions<TParams> & { auth: 'required' }
) {
  return (req: NextRequest, context?: ApiRouteContext<TParams>) => handleApiRoute(req, context, handler, options)
}
