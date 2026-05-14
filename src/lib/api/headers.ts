import { NO_STORE_HEADERS } from '@/lib/http'
import { REQUEST_ID_HEADER } from '@/lib/api/request-id'

export function mergeHeaders(...sources: Array<HeadersInit | undefined>) {
  const headers = new Headers()

  for (const source of sources) {
    if (!source) continue
    new Headers(source).forEach((value, key) => headers.set(key, value))
  }

  return headers
}

export function apiHeaders(requestId?: string, headers?: HeadersInit) {
  return mergeHeaders(NO_STORE_HEADERS, requestId ? { [REQUEST_ID_HEADER]: requestId } : undefined, headers)
}
