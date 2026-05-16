export type QueryValue = string | number | boolean | null | undefined

export type QueryParams = Record<string, QueryValue | QueryValue[]>

export type ApiClientRequestOptions<TBody = unknown> = {
  body?: TBody
  cache?: RequestCache
  headers?: HeadersInit
  idempotencyKey?: string
  method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'
  query?: QueryParams
  retries?: number
  signal?: AbortSignal
}

export type ApiClientErrorPayload = {
  body?: unknown
  code?: string
  details?: unknown
  requestId?: string
  status: number
}
