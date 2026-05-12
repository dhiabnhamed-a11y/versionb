import { emitCompanyRealtime } from '@/lib/realtime-server'
import { ProviderError } from '@/modules/integrations/core/errors'
import { getSocialProvider } from '@/modules/integrations/core/provider-registry'
import type { ProviderSyncCursor } from '@/modules/integrations/core/types'
import {
  findConnectedAccountForCompany,
  getDecryptedAccountTokens,
  markSocialSyncJob,
  markTokenRefreshFailure,
  persistProviderSyncResult,
  updateProviderToken,
} from '@/modules/integrations/repositories/integration.repository'
import { enqueueSocialIntegrationJob } from '@/modules/integrations/jobs/social-job-queue'
import { recordIntegrationActivity } from '@/modules/integrations/security/audit'
import { addUtcDays, parseOptionalDate, startOfUtcDay } from '@/modules/integrations/utils/dates'
import { notFound } from '@/modules/shared/errors'

type SyncInput = {
  companyId: string
  connectedAccountId: string
  providerSlug: string
  syncJobId?: string | null
  mode?: 'initial' | 'incremental' | 'full'
  since?: string | Date | null
  until?: string | Date | null
  attempts?: number
}

function needsRefresh(expiresAt?: Date | null) {
  return Boolean(expiresAt && expiresAt.getTime() < Date.now() + 5 * 60 * 1000)
}

function cursorFor(input: SyncInput, account: { lastSyncAt: Date | null; syncCursor: string | null }): ProviderSyncCursor {
  const until = startOfUtcDay(parseOptionalDate(input.until) ?? new Date())
  const requestedSince = parseOptionalDate(input.since)
  const since =
    requestedSince ??
    (input.mode === 'full'
      ? addUtcDays(until, -365)
      : account.lastSyncAt
        ? addUtcDays(startOfUtcDay(account.lastSyncAt), -3)
        : addUtcDays(until, -30))

  return {
    cursor: input.mode === 'full' ? null : account.syncCursor,
    since,
    until,
  }
}

export async function runAccountSync(input: SyncInput) {
  const provider = getSocialProvider(input.providerSlug)
  const account = await findConnectedAccountForCompany(input.companyId, input.connectedAccountId)
  if (!account) throw notFound('Connected account not found.')

  await markSocialSyncJob(input.syncJobId, 'ACTIVE', { attempts: input.attempts ?? 1 })

  let tokens = await getDecryptedAccountTokens(account.id)
  if (needsRefresh(tokens.expiresAt)) {
    try {
      const refreshed = await provider.refreshToken({
        tokens,
        context: { companyId: input.companyId, accountId: account.id, providerSlug: provider.slug },
      })
      await updateProviderToken(account.id, refreshed)
      tokens = {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken ?? tokens.refreshToken ?? null,
        tokenType: refreshed.tokenType ?? tokens.tokenType,
        scope: refreshed.scope ?? tokens.scope,
        expiresAt: refreshed.expiresAt ?? null,
      }
    } catch (error) {
      await markTokenRefreshFailure(account.id, error instanceof Error ? error.message : String(error))
      throw error
    }
  }

  const result = await provider.sync({
    tokens,
    cursor: cursorFor(input, account),
    context: { companyId: input.companyId, accountId: account.id, providerSlug: provider.slug },
  })

  await persistProviderSyncResult({
    account,
    analytics: result.analytics,
    revenue: result.revenue,
    content: result.content,
    syncJobId: input.syncJobId,
    nextCursor: result.nextCursor,
  })

  const summary = {
    profile: Boolean(result.profile),
    snapshots: result.analytics?.snapshots?.length ?? 0,
    engagement: result.analytics?.engagement?.length ?? 0,
    realtime: result.analytics?.realtime?.length ?? 0,
    audience: result.analytics?.audience?.length ?? 0,
    revenue: result.revenue?.revenue?.length ?? 0,
    content: result.content?.content?.length ?? 0,
    nextCursor: result.nextCursor ?? null,
  }

  await markSocialSyncJob(input.syncJobId, 'COMPLETED', { result: summary, cursor: result.nextCursor ?? undefined, attempts: input.attempts ?? 1 })
  await recordIntegrationActivity({
    companyId: input.companyId,
    connectedAccountId: account.id,
    action: 'social.sync.completed',
    metadata: { provider: provider.slug, summary },
  })

  emitCompanyRealtime(input.companyId, 'social_sync_completed', { accountId: account.id, provider: provider.slug, summary })
  emitCompanyRealtime(input.companyId, 'social_metrics_updated', { accountId: account.id, provider: provider.slug, summary })

  await enqueueSocialIntegrationJob({
    name: 'social.ai-insights.generate',
    companyId: input.companyId,
    providerSlug: provider.slug,
    connectedAccountId: account.id,
    payload: { sourceSyncJobId: input.syncJobId ?? null },
    priority: 60,
    maxAttempts: 3,
  })

  return summary
}

export function syncErrorStatus(error: unknown) {
  if (error instanceof ProviderError && error.reason === 'RATE_LIMITED') return 'FAILED_RATE_LIMITED'
  if (error instanceof ProviderError && error.reason === 'CONFIGURATION_MISSING') return 'FAILED_CONFIGURATION'
  return 'FAILED'
}
