import { logger } from '@/modules/shared/logger'

type MetricLabels = Record<string, string | number | boolean | null | undefined>

export type ErrorContext = MetricLabels & {
  requestId?: string
  userId?: string
  companyId?: string
  route?: string
}

export function recordMetric(name: string, labels: MetricLabels = {}, value = 1) {
  logger.info('metric', { name, value, ...labels })
}

export function recordDuration(name: string, startedAt: number, labels: MetricLabels = {}) {
  recordMetric(`${name}.duration_ms`, labels, Date.now() - startedAt)
}

export function captureException(error: unknown, context: ErrorContext = {}) {
  const err = error instanceof Error ? error : new Error(String(error))
  logger.error('exception', err, {
    errorName: err.name,
    errorMessage: err.message,
    ...context,
  })

  // Forward to external error reporter when configured
  const dsn = process.env.SENTRY_DSN
  if (dsn && typeof globalThis.__sentryCapture === 'function') {
    globalThis.__sentryCapture(error, context)
  }
}

export function withErrorContext<T>(
  fn: () => Promise<T>,
  context: ErrorContext
): Promise<T> {
  return fn().catch((err) => {
    captureException(err, context)
    throw err
  })
}

declare global {
  // eslint-disable-next-line no-var
  var __sentryCapture: ((error: unknown, context: ErrorContext) => void) | undefined
}
