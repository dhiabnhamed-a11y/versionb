import { enqueueOperationalJob } from '@/modules/jobs/job-queue'
import type { SocialProviderSlug } from '@/modules/integrations/core/types'
import { attachJobRunToSyncJob, createSocialSyncJob } from '@/modules/integrations/repositories/integration.repository'

export const SOCIAL_INTEGRATIONS_QUEUE = 'social-integrations'

export type SocialIntegrationJobName =
  | 'social.analytics.sync'
  | 'social.token.refresh'
  | 'social.webhook.process'
  | 'social.ai-insights.generate'
  | 'social.realtime.update'

export async function enqueueSocialIntegrationJob(input: {
  name: SocialIntegrationJobName
  companyId: string
  providerSlug: SocialProviderSlug
  connectedAccountId?: string | null
  entityType?: string | null
  entityId?: string | null
  payload?: Record<string, unknown>
  runAt?: Date | null
  maxAttempts?: number
  priority?: number
}) {
  const syncJob = await createSocialSyncJob({
    companyId: input.companyId,
    connectedAccountId: input.connectedAccountId ?? null,
    providerSlug: input.providerSlug,
    jobType: input.name,
    priority: input.priority,
    scheduledFor: input.runAt ?? undefined,
    maxAttempts: input.maxAttempts,
    payload: input.payload,
  })

  const jobRun = await enqueueOperationalJob({
    queue: SOCIAL_INTEGRATIONS_QUEUE,
    name: input.name,
    companyId: input.companyId,
    entityType: input.entityType ?? 'connected_account',
    entityId: input.entityId ?? input.connectedAccountId ?? syncJob.id,
    payload: {
      ...(input.payload ?? {}),
      syncJobId: syncJob.id,
      companyId: input.companyId,
      providerSlug: input.providerSlug,
      connectedAccountId: input.connectedAccountId ?? null,
    },
    runAt: input.runAt ?? null,
    maxAttempts: input.maxAttempts ?? 5,
  })

  if (jobRun?.id) await attachJobRunToSyncJob(syncJob.id, jobRun.id)
  return { syncJob, jobRun }
}
