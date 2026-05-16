import 'server-only'

import { enqueueOperationalJob } from '@/modules/jobs/job-queue'

export const AI_QUEUE_NAMES = {
  planning: 'ai-planning',
  execution: 'ai-execution',
  embeddings: 'ai-embeddings',
  reports: 'ai-reports',
} as const

export async function enqueueAiJob(input: {
  name: string
  companyId: string
  entityType?: string
  entityId?: string
  payload: unknown
  queue?: keyof typeof AI_QUEUE_NAMES
  runAt?: Date | null
  maxAttempts?: number
}) {
  return enqueueOperationalJob({
    queue: AI_QUEUE_NAMES[input.queue ?? 'execution'],
    name: input.name,
    companyId: input.companyId,
    entityType: input.entityType ?? 'ai_run',
    entityId: input.entityId ?? null,
    payload: input.payload,
    runAt: input.runAt ?? null,
    maxAttempts: input.maxAttempts ?? 3,
  })
}
