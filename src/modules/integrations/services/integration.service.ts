import type { SessionUser } from '@/modules/shared/session'
import { assertCanManageIntegrations, assertCanReadIntegrations, requireIntegrationCompany } from '@/modules/integrations/security/rbac'
import {
  disconnectConnectedAccount,
  findConnectedAccountForCompany,
  getDecryptedAccountTokens,
  listConnectedAccounts,
  listSocialPlatformsForCompany,
} from '@/modules/integrations/repositories/integration.repository'
import { getSocialProvider } from '@/modules/integrations/core/provider-registry'
import { notFound } from '@/modules/shared/errors'
import { recordIntegrationActivity } from '@/modules/integrations/security/audit'
import { enqueueSocialIntegrationJob } from '@/modules/integrations/jobs/social-job-queue'
import type { ManualSyncInput } from '@/modules/integrations/services/integration.validation'

export async function listIntegrationProviders(user: SessionUser) {
  assertCanReadIntegrations(user)
  const companyId = requireIntegrationCompany(user)
  return listSocialPlatformsForCompany(companyId)
}

export async function listWorkspaceConnectedAccounts(user: SessionUser) {
  assertCanReadIntegrations(user)
  const companyId = requireIntegrationCompany(user)
  return listConnectedAccounts(companyId)
}

export async function disconnectWorkspaceConnectedAccount(user: SessionUser, accountId: string) {
  assertCanManageIntegrations(user)
  const companyId = requireIntegrationCompany(user)
  const account = await findConnectedAccountForCompany(companyId, accountId)
  if (!account) throw notFound('Connected account not found.')

  const provider = getSocialProvider(account.platformSlug)
  const tokens = await getDecryptedAccountTokens(account.id)
  await provider.disconnect({
    tokens,
    context: { companyId, userId: user.id, accountId: account.id, providerSlug: provider.slug },
  })
  const disconnected = await disconnectConnectedAccount(companyId, account.id)
  await recordIntegrationActivity({
    companyId,
    connectedAccountId: account.id,
    actorId: user.id,
    action: 'social.account.disconnected',
    metadata: { provider: provider.slug },
  })
  return disconnected
}

export async function enqueueManualAccountSync(user: SessionUser, accountId: string, input: ManualSyncInput) {
  assertCanManageIntegrations(user)
  const companyId = requireIntegrationCompany(user)
  const account = await findConnectedAccountForCompany(companyId, accountId)
  if (!account) throw notFound('Connected account not found.')
  const provider = getSocialProvider(account.platformSlug)

  const run = await enqueueSocialIntegrationJob({
    name: 'social.analytics.sync',
    companyId,
    providerSlug: provider.slug,
    connectedAccountId: account.id,
    payload: {
      mode: input.syncMode,
      since: input.since ?? null,
      until: input.until ?? null,
      manual: true,
      requestedById: user.id,
    },
    priority: input.syncMode === 'full' ? 30 : 10,
    maxAttempts: 5,
  })

  await recordIntegrationActivity({
    companyId,
    connectedAccountId: account.id,
    actorId: user.id,
    action: 'social.sync.manual_requested',
    metadata: { provider: provider.slug, syncMode: input.syncMode, syncJobId: run.syncJob.id },
  })

  return run
}
