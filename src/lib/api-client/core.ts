import { REQUEST_ID_HEADER } from '@/lib/api/request-id'
import type { ApiResponse } from '@/lib/api/types'
import type { ApiClientErrorPayload, ApiClientRequestOptions, QueryParams, QueryValue } from '@/lib/api-client/types'

function createRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function isApiEnvelope<TData>(value: unknown): value is ApiResponse<TData> {
  if (!isPlainObject(value)) return false
  return 'data' in value && 'error' in value && 'code' in value && typeof value.requestId === 'string'
}

function appendQueryValue(searchParams: URLSearchParams, key: string, value: QueryValue) {
  if (value === undefined || value === null || value === '') return
  searchParams.append(key, String(value))
}

function buildUrl(path: string, query?: QueryParams) {
  if (!query) return path

  const [base, existingQuery = ''] = path.split('?')
  const searchParams = new URLSearchParams(existingQuery)
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      value.forEach((item) => appendQueryValue(searchParams, key, item))
    } else {
      appendQueryValue(searchParams, key, value)
    }
  }

  const queryString = searchParams.toString()
  return queryString ? `${base}?${queryString}` : base
}

async function parseBody(response: Response) {
  const text = await response.text()
  if (!text) return undefined

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function messageFromBody(body: unknown, fallback: string) {
  if (isPlainObject(body)) {
    if (typeof body.error === 'string') return body.error
    if (typeof body.message === 'string') return body.message
  }

  return fallback
}

function codeFromBody(body: unknown) {
  return isPlainObject(body) && typeof body.code === 'string' ? body.code : undefined
}

function detailsFromBody(body: unknown) {
  return isPlainObject(body) && 'details' in body ? body.details : undefined
}

function requestIdFromBody(body: unknown) {
  return isPlainObject(body) && typeof body.requestId === 'string' ? body.requestId : undefined
}

function unwrapResponse<TData>(body: unknown): TData {
  if (isApiEnvelope<TData>(body)) return body.data as TData
  return body as TData
}

export class ApiClientError extends Error {
  body?: unknown
  code?: string
  details?: unknown
  requestId?: string
  status: number

  constructor(message: string, payload: ApiClientErrorPayload) {
    super(message)
    this.name = 'ApiClientError'
    this.body = payload.body
    this.code = payload.code
    this.details = payload.details
    this.requestId = payload.requestId
    this.status = payload.status
  }
}

export function getApiErrorMessage(error: unknown, fallback = 'Request failed.') {
  return error instanceof Error ? error.message : fallback
}

export async function apiRequest<TData, TBody = unknown>(path: string, options: ApiClientRequestOptions<TBody> = {}): Promise<TData> {
  const method = options.method ?? 'GET'
  const requestId = createRequestId()
  const headers = new Headers(options.headers)
  headers.set(REQUEST_ID_HEADER, requestId)

  const hasBody = options.body !== undefined
  let body: BodyInit | undefined
  if (hasBody) {
    headers.set('Content-Type', headers.get('Content-Type') ?? 'application/json')
    body = headers.get('Content-Type')?.includes('application/json') ? JSON.stringify(options.body) : (options.body as BodyInit)
  }

  const retryCount = options.retries ?? (method === 'GET' ? 1 : 0)
  let lastError: unknown

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      const response = await fetch(buildUrl(path, options.query), {
        body,
        cache: options.cache ?? 'no-store',
        credentials: 'same-origin',
        headers,
        method,
        signal: options.signal,
      })
      const parsedBody = await parseBody(response)
      const responseRequestId = response.headers.get(REQUEST_ID_HEADER) ?? requestIdFromBody(parsedBody) ?? requestId

      if (!response.ok) {
        throw new ApiClientError(messageFromBody(parsedBody, 'Request failed.'), {
          body: parsedBody,
          code: codeFromBody(parsedBody),
          details: detailsFromBody(parsedBody),
          requestId: responseRequestId,
          status: response.status,
        })
      }

      return unwrapResponse<TData>(parsedBody)
    } catch (error) {
      lastError = error
      if (error instanceof ApiClientError && error.status < 500) throw error
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      if (attempt === retryCount) break
    }
  }

  throw lastError
}
