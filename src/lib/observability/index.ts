import { logger } from '@/modules/shared/logger'

export type ApiTrace = {
  companyId?: string | null
  durationMs: number
  method?: string
  requestId: string
  route?: string
  status?: number
  userId?: string | null
}

export function recordApiRequest(trace: ApiTrace) {
  logger.info('api.request_completed', {
    companyId: trace.companyId,
    durationMs: trace.durationMs,
    method: trace.method,
    requestId: trace.requestId,
    route: trace.route,
    status: trace.status,
    userId: trace.userId,
  })
}

export function recordApiError(error: unknown, trace: Omit<ApiTrace, 'durationMs'> & { code?: string; durationMs?: number }) {
  logger.error('api.request_failed', error, {
    code: trace.code,
    companyId: trace.companyId,
    durationMs: trace.durationMs,
    method: trace.method,
    requestId: trace.requestId,
    route: trace.route,
    status: trace.status,
    userId: trace.userId,
  })
}

export async function withTiming<T>(name: string, context: Record<string, unknown>, work: () => Promise<T>) {
  const startedAt = Date.now()
  try {
    const result = await work()
    logger.info(`${name}.completed`, { ...context, durationMs: Date.now() - startedAt })
    return result
  } catch (error) {
    logger.error(`${name}.failed`, error, { ...context, durationMs: Date.now() - startedAt })
    throw error
  }
}
