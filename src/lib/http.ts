export const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
} as const

export const PRIVATE_SHORT_CACHE_HEADERS = {
  'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
} as const

export const PUBLIC_STATIC_CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
} as const

export const JSON_CONTENT_TYPE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
} as const

export function traceHeaders(requestId: string, headers: HeadersInit = {}) {
  return {
    ...headers,
    'X-Request-Id': requestId,
  }
}
