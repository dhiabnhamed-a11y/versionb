import { NextResponse } from 'next/server'
import { NO_STORE_HEADERS } from '@/lib/http'
import { logger } from '@/modules/shared/logger'
import { normalizeError, type ApiErrorPayload } from '@/modules/shared/errors'

export function okJson<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...NO_STORE_HEADERS,
      ...(init?.headers ?? {}),
    },
  })
}

export async function withApiError(handler: () => Promise<Response>) {
  try {
    return await handler()
  } catch (error) {
    const normalized = normalizeError(error)
    if (normalized.status >= 500) {
      logger.error('api.unhandled_error', error, { code: normalized.code })
    }

    const payload: ApiErrorPayload = {
      error: normalized.expose ? normalized.message : 'Server error',
      code: normalized.code,
      details: normalized.expose ? normalized.details : undefined,
    }

    return NextResponse.json(payload, { status: normalized.status })
  }
}

export async function parseJsonObject(req: Request) {
  const body = await req.json().catch(() => ({}))
  return body && typeof body === 'object' ? body : {}
}
