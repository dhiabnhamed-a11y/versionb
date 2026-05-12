import { emitCompanyRealtime } from '@/lib/realtime-server'
import { getSocialProvider } from '@/modules/integrations/core/provider-registry'
import type { SocialProviderSlug } from '@/modules/integrations/core/types'
import {
  findConnectedAccountForCompany,
  getDecryptedAccountTokens,
  markSocialSyncJob,
  markTokenRefreshFailure,
  updateProviderToken,
} from '@/modules/integrations/repositories/integration.repository'
import { generateSocialInsights } from '@/modules/integrations/services/ai-insights.service'
import { runAccountSync, syncErrorStatus } from '@/modules/integrations/services/sync-engine.service'
import { processSocialWebhookEvent } from '@/modules/integrations/webhooks/webhook.service'
import type { SocialIntegrationJobName } from '@/modules/integrations/jobs/social-job-queue'

type SocialJobPayload = {
  syncJobId?: string
  companyId?: string
  providerSlug?: SocialProviderSlug
  connectedAccountId?: string | null
  webhookEventId?: string
  mode?: 'initial' | 'incremental' | 'full'
  since?: string | null
  until?: string | null
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== 'string' || !value) throw new Error(`${label} is required.`)
  return value
}

async function refreshAccountToken(input: Required<Pick<SocialJobPayload, 'companyId' | 'providerSlug'>> & { connectedAccountId: string; syncJobId?: string; attempts?: number }) {
  const provider = getSocialProvider(input.providerSlug)
  const account = await findConnectedAccountForCompany(input.companyId, input.connectedAccountId)
  if (!account) throw new Error('Connected account not found.')
  await markSocialSyncJob(input.syncJobId, 'ACTIVE', { attempts: input.attempts ?? 1 })

  try {
    const tokens = await getDecryptedAccountTokens(account.id)
    const refreshed = await provider.refreshToken({
      tokens,
      context: { companyId: input.companyId, providerSlug: provider.slug, accountId: account.id },
    })
    await updateProviderToken(account.id, refreshed)
    await markSocialSyncJob(input.syncJobId, 'COMPLETED', { result: { refreshed: true }, attempts: input.attempts ?? 1 })
    return { refreshed: true, accountId: account.id }
  } catch (error) {
    await markTokenRefreshFailure(account.id, error instanceof Error ? error.message : String(error))
    throw error
  }
}

export async function processSocialIntegrationJob(jobName: string, payload: SocialJobPayload, attempts: number) {
  try {
    if (jobName === 'social.analytics.sync') {
      return await runAccountSync({
        companyId: requiredString(payload.companyId, 'companyId'),
        connectedAccountId: requiredString(payload.connectedAccountId, 'connectedAccountId'),
        providerSlug: requiredString(payload.providerSlug, 'providerSlug'),
        syncJobId: payload.syncJobId,
        mode: payload.mode,
        since: payload.since,
        until: payload.until,
        attempts,
      })
    }

    if (jobName === 'social.token.refresh') {
      return refreshAccountToken({
        companyId: requiredString(payload.companyId, 'companyId'),
        providerSlug: requiredString(payload.providerSlug, 'providerSlug') as SocialProviderSlug,
        connectedAccountId: requiredString(payload.connectedAccountId, 'connectedAccountId'),
        syncJobId: payload.syncJobId,
        attempts,
      })
    }

    if (jobName === 'social.webhook.process') {
      const result = await processSocialWebhookEvent({
        webhookEventId: requiredString(payload.webhookEventId, 'webhookEventId'),
        attempts,
      })
      await markSocialSyncJob(payload.syncJobId, 'COMPLETED', { result, attempts })
      return result
    }

    if (jobName === 'social.ai-insights.generate') {
      const result = await generateSocialInsights({
        companyId: requiredString(payload.companyId, 'companyId'),
        connectedAccountId: requiredString(payload.connectedAccountId, 'connectedAccountId'),
      })
      await markSocialSyncJob(payload.syncJobId, 'COMPLETED', { result: { count: result.length }, attempts })
      return { count: result.length }
    }

    if (jobName === 'social.realtime.update') {
      const companyId = requiredString(payload.companyId, 'companyId')
      emitCompanyRealtime(companyId, 'social_metrics_updated', {
        accountId: payload.connectedAccountId ?? null,
        provider: payload.providerSlug ?? null,
      })
      await markSocialSyncJob(payload.syncJobId, 'COMPLETED', { result: { emitted: true }, attempts })
      return { emitted: true }
    }

    return { ignored: true, jobName: jobName as SocialIntegrationJobName }
  } catch (error) {
    await markSocialSyncJob(payload.syncJobId, syncErrorStatus(error), {
      error: error instanceof Error ? error.message : String(error),
      attempts,
    })
    throw error
  }
}
