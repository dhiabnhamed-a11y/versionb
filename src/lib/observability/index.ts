import { logger } from '@/modules/shared/logger'

type MetricLabels = Record<string, string | number | boolean | null | undefined>

export function recordMetric(name: string, labels: MetricLabels = {}, value = 1) {
  logger.info('metric', { name, value, ...labels })
}

export function recordDuration(name: string, startedAt: number, labels: MetricLabels = {}) {
  recordMetric(`${name}.duration_ms`, labels, Date.now() - startedAt)
}

export function captureException(error: unknown, context: MetricLabels = {}) {
  logger.error('exception', error, context)
}
