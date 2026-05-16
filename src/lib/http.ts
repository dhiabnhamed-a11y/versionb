export const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
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
