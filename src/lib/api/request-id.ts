export const REQUEST_ID_HEADER = 'X-Request-Id'
export const CORRELATION_ID_HEADER = 'x-correlation-id'

function createRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function isSafeRequestId(value: string | null | undefined) {
  return Boolean(value && value.length <= 128 && /^[a-zA-Z0-9._:-]+$/.test(value))
}

export function getRequestId(req?: Pick<Request, 'headers'> | null) {
  const incoming = req?.headers.get(REQUEST_ID_HEADER) ?? req?.headers.get(CORRELATION_ID_HEADER) ?? null
  return isSafeRequestId(incoming) ? incoming! : createRequestId()
}
