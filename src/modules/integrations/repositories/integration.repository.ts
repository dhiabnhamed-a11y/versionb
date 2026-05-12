import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { isMissingDatabaseObjectError } from '@/lib/prisma-errors'
import { SOCIAL_PROVIDER_DEFINITIONS } from '@/modules/integrations/core/provider-config'
import type {
  ProviderAnalyticsResult,
  ProviderRevenueResult,
  ProviderTokenInput,
  ProviderTokenSet,
  SocialContentItem,
  SocialProfile,
  SocialProviderSlug,
} from '@/modules/integrations/core/types'
import { currentTokenKeyId, decryptToken, encryptToken } from '@/modules/integrations/security/token-crypto'
import { stableHash } from '@/modules/integrations/utils/hash'
import { toJsonValue } from '@/modules/shared/json'
import { logger } from '@/modules/shared/logger'

export type ConnectedSocialAccountRecord = Awaited<ReturnType<typeof findConnectedAccountForCompany>>

const accountSelect = {
  id: true,
  companyId: true,
  platformId: true,
  platformSlug: true,
  creatorProfileId: true,
  providerAccountId: true,
  handle: true,
  displayName: true,
  avatarUrl: true,
  accountType: true,
  status: true,
  healthStatus: true,
  scopes: true,
  metadata: true,
  syncCursor: true,
  lastSyncAt: true,
  createdAt: true,
  updatedAt: true,
  platform: {
    select: {
      slug: true,
      displayName: true,
      capabilities: true,
      requiredScopes: true,
      optionalScopes: true,
      status: true,
    },
  },
  creatorProfile: {
    select: { id: true, displayName: true, avatarUrl: true, status: true },
  },
} satisfies Prisma.ConnectedAccountSelect

export async function ensureSocialPlatforms() {
  try {
    await Promise.all(
      SOCIAL_PROVIDER_DEFINITIONS.map((provider) =>
        prisma.socialPlatform.upsert({
          where: { slug: provider.slug },
          update: {
            displayName: provider.displayName,
            category: provider.category,
            capabilities: toJsonValue(provider.capabilities)!,
            requiredScopes: provider.requiredScopes,
            optionalScopes: provider.optionalScopes,
            status: 'ACTIVE',
          },
          create: {
            slug: provider.slug,
            displayName: provider.displayName,
            category: provider.category,
            capabilities: toJsonValue(provider.capabilities)!,
            requiredScopes: provider.requiredScopes,
            optionalScopes: provider.optionalScopes,
            status: 'ACTIVE',
          },
        })
      )
    )
  } catch (error) {
    if (isMissingDatabaseObjectError(error)) {
      logger.warn('integrations.platform_seed_skipped_missing_schema')
      return
    }
    throw error
  }
}

export async function listSocialPlatformsForCompany(companyId: string) {
  await ensureSocialPlatforms()
  const [platforms, counts] = await Promise.all([
    prisma.socialPlatform.findMany({ orderBy: { displayName: 'asc' } }),
    prisma.connectedAccount.groupBy({
      by: ['platformSlug'],
      where: { companyId, status: { not: 'DISCONNECTED' } },
      _count: { _all: true },
    }),
  ])
  const countMap = new Map(counts.map((item) => [item.platformSlug, item._count._all]))
  return platforms.map((platform) => ({ ...platform, connectedCount: countMap.get(platform.slug) ?? 0 }))
}

export async function findPlatformBySlug(slug: SocialProviderSlug) {
  await ensureSocialPlatforms()
  return prisma.socialPlatform.findUnique({ where: { slug } })
}

export async function findConnectedAccountForCompany(companyId: string, accountId: string) {
  return prisma.connectedAccount.findFirst({
    where: { id: accountId, companyId },
    select: accountSelect,
  })
}

export async function listConnectedAccounts(companyId: string) {
  return prisma.connectedAccount.findMany({
    where: { companyId, status: { not: 'DISCONNECTED' } },
    select: accountSelect,
    orderBy: [{ platformSlug: 'asc' }, { updatedAt: 'desc' }],
  })
}

export async function upsertConnectedAccount(input: {
  companyId: string
  connectedById: string
  providerSlug: SocialProviderSlug
  profile: SocialProfile
  tokenSet: ProviderTokenSet
  scopes: string[]
}) {
  const platform = await findPlatformBySlug(input.providerSlug)
  if (!platform) throw new Error(`Social platform ${input.providerSlug} is not registered.`)

  const tokenData = {
    accessTokenCiphertext: encryptToken(input.tokenSet.accessToken),
    refreshTokenCiphertext: input.tokenSet.refreshToken ? encryptToken(input.tokenSet.refreshToken) : undefined,
    tokenType: input.tokenSet.tokenType ?? 'Bearer',
    scope: input.tokenSet.scope ?? input.scopes.join(' '),
    expiresAt: input.tokenSet.expiresAt ?? null,
    lastRefreshedAt: null,
    refreshFailureCount: 0,
    revokedAt: null,
    keyId: currentTokenKeyId(),
  }

  const account = await prisma.connectedAccount.upsert({
    where: {
      companyId_platformId_providerAccountId: {
        companyId: input.companyId,
        platformId: platform.id,
        providerAccountId: input.profile.providerAccountId,
      },
    },
    update: {
      connectedById: input.connectedById,
      platformSlug: input.providerSlug,
      handle: input.profile.handle ?? null,
      displayName: input.profile.displayName,
      avatarUrl: input.profile.avatarUrl ?? null,
      accountType: input.profile.accountType ?? 'PROFILE',
      status: 'CONNECTED',
      healthStatus: 'HEALTHY',
      scopes: input.scopes,
      externalCreatedAt: input.profile.externalCreatedAt ?? null,
      metadata: toJsonValue(input.profile.metadata),
      token: {
        upsert: {
          update: tokenData,
          create: tokenData,
        },
      },
    },
    create: {
      companyId: input.companyId,
      platformId: platform.id,
      platformSlug: input.providerSlug,
      connectedById: input.connectedById,
      providerAccountId: input.profile.providerAccountId,
      handle: input.profile.handle ?? null,
      displayName: input.profile.displayName,
      avatarUrl: input.profile.avatarUrl ?? null,
      accountType: input.profile.accountType ?? 'PROFILE',
      status: 'CONNECTED',
      healthStatus: 'HEALTHY',
      scopes: input.scopes,
      externalCreatedAt: input.profile.externalCreatedAt ?? null,
      metadata: toJsonValue(input.profile.metadata),
      token: {
        create: tokenData,
      },
    },
    select: accountSelect,
  })

  return account
}

export async function getDecryptedAccountTokens(accountId: string): Promise<ProviderTokenInput> {
  const token = await prisma.providerToken.findUnique({
    where: { connectedAccountId: accountId },
  })
  if (!token || token.revokedAt) throw new Error('Connected social account has no active token.')

  return {
    accessToken: decryptToken(token.accessTokenCiphertext),
    refreshToken: token.refreshTokenCiphertext ? decryptToken(token.refreshTokenCiphertext) : null,
    tokenType: token.tokenType,
    scope: token.scope,
    expiresAt: token.expiresAt,
  }
}

export async function updateProviderToken(accountId: string, tokenSet: ProviderTokenSet) {
  const existing = await prisma.providerToken.findUnique({ where: { connectedAccountId: accountId } })
  return prisma.providerToken.update({
    where: { connectedAccountId: accountId },
    data: {
      accessTokenCiphertext: encryptToken(tokenSet.accessToken),
      refreshTokenCiphertext:
        tokenSet.refreshToken === undefined
          ? undefined
          : tokenSet.refreshToken
            ? encryptToken(tokenSet.refreshToken)
            : existing?.refreshTokenCiphertext ?? null,
      tokenType: tokenSet.tokenType ?? existing?.tokenType ?? 'Bearer',
      scope: tokenSet.scope ?? existing?.scope ?? null,
      expiresAt: tokenSet.expiresAt ?? null,
      rotationVersion: { increment: 1 },
      lastRefreshedAt: new Date(),
      refreshFailureCount: 0,
      keyId: currentTokenKeyId(),
    },
  })
}

export async function markTokenRefreshFailure(accountId: string, error: string) {
  await prisma.$transaction([
    prisma.providerToken.update({
      where: { connectedAccountId: accountId },
      data: { refreshFailureCount: { increment: 1 } },
    }),
    prisma.connectedAccount.update({
      where: { id: accountId },
      data: { healthStatus: 'TOKEN_REFRESH_FAILED', metadata: toJsonValue({ lastTokenRefreshError: error }) },
    }),
  ])
}

export async function disconnectConnectedAccount(companyId: string, accountId: string) {
  const existing = await prisma.connectedAccount.findFirst({ where: { id: accountId, companyId }, select: { id: true } })
  if (!existing) return null

  return prisma.connectedAccount.update({
    where: { id: accountId },
    data: {
      status: 'DISCONNECTED',
      healthStatus: 'DISCONNECTED',
      token: {
        update: { revokedAt: new Date() },
      },
    },
    select: accountSelect,
  })
}

export async function createSocialSyncJob(input: {
  companyId: string
  connectedAccountId?: string | null
  providerSlug: SocialProviderSlug
  jobType: string
  priority?: number
  scheduledFor?: Date
  maxAttempts?: number
  payload?: unknown
  jobRunId?: string | null
}) {
  return prisma.socialSyncJob.create({
    data: {
      companyId: input.companyId,
      connectedAccountId: input.connectedAccountId ?? null,
      providerSlug: input.providerSlug,
      jobType: input.jobType,
      priority: input.priority ?? 50,
      scheduledFor: input.scheduledFor ?? new Date(),
      maxAttempts: input.maxAttempts ?? 5,
      payload: toJsonValue(input.payload),
      jobRunId: input.jobRunId ?? null,
    },
  })
}

export async function attachJobRunToSyncJob(syncJobId: string, jobRunId: string) {
  return prisma.socialSyncJob.update({ where: { id: syncJobId }, data: { jobRunId } })
}

export async function markSocialSyncJob(syncJobId: string | undefined | null, status: string, data: Record<string, unknown> = {}) {
  if (!syncJobId) return null
  return prisma.socialSyncJob.update({
    where: { id: syncJobId },
    data: {
      status,
      attempts: typeof data.attempts === 'number' ? data.attempts : undefined,
      startedAt: status === 'ACTIVE' ? new Date() : undefined,
      completedAt: ['COMPLETED', 'FAILED', 'DEAD_LETTER'].includes(status) ? new Date() : undefined,
      cursor: typeof data.cursor === 'string' ? data.cursor : undefined,
      result: data.result === undefined ? undefined : toJsonValue(data.result),
      error: typeof data.error === 'string' ? data.error : undefined,
    },
  })
}

async function upsertContentItems(tx: Prisma.TransactionClient, account: NonNullable<ConnectedSocialAccountRecord>, content: SocialContentItem[]) {
  const map = new Map<string, string>()
  for (const item of content) {
    const row = await tx.contentPerformance.upsert({
      where: {
        connectedAccountId_providerContentId: {
          connectedAccountId: account.id,
          providerContentId: item.providerContentId,
        },
      },
      update: {
        contentType: item.contentType,
        title: item.title,
        description: item.description ?? null,
        url: item.url ?? null,
        thumbnailUrl: item.thumbnailUrl ?? null,
        publishedAt: item.publishedAt ?? null,
        durationSeconds: item.durationSeconds ?? null,
        metrics: toJsonValue(item.metrics),
        revenue: toJsonValue(item.revenue),
        lastSyncedAt: new Date(),
      },
      create: {
        companyId: account.companyId,
        connectedAccountId: account.id,
        platformSlug: account.platformSlug,
        providerContentId: item.providerContentId,
        contentType: item.contentType,
        title: item.title,
        description: item.description ?? null,
        url: item.url ?? null,
        thumbnailUrl: item.thumbnailUrl ?? null,
        publishedAt: item.publishedAt ?? null,
        durationSeconds: item.durationSeconds ?? null,
        metrics: toJsonValue(item.metrics),
        revenue: toJsonValue(item.revenue),
        lastSyncedAt: new Date(),
      },
      select: { id: true, providerContentId: true },
    })
    map.set(row.providerContentId, row.id)
  }
  return map
}

export async function persistProviderSyncResult(input: {
  account: NonNullable<ConnectedSocialAccountRecord>
  analytics?: ProviderAnalyticsResult
  revenue?: ProviderRevenueResult
  content?: { content?: SocialContentItem[]; nextCursor?: string | null }
  syncJobId?: string | null
  nextCursor?: string | null
}) {
  const account = input.account
  const contentItems = input.content?.content ?? []

  await prisma.$transaction(async (tx) => {
    const contentIdByProviderId = await upsertContentItems(tx, account, contentItems)

    for (const snapshot of input.analytics?.snapshots ?? []) {
      await tx.analyticsSnapshot.upsert({
        where: {
          connectedAccountId_metricDate_granularity_fingerprint: {
            connectedAccountId: account.id,
            metricDate: snapshot.metricDate,
            granularity: snapshot.granularity,
            fingerprint: snapshot.fingerprint,
          },
        },
        update: {
          metrics: toJsonValue(snapshot.metrics)!,
          dimensions: toJsonValue(snapshot.dimensions),
          syncJobId: input.syncJobId ?? null,
        },
        create: {
          companyId: account.companyId,
          connectedAccountId: account.id,
          platformSlug: account.platformSlug,
          metricDate: snapshot.metricDate,
          granularity: snapshot.granularity,
          metrics: toJsonValue(snapshot.metrics)!,
          dimensions: toJsonValue(snapshot.dimensions),
          fingerprint: snapshot.fingerprint,
          syncJobId: input.syncJobId ?? null,
        },
      })
    }

    for (const metric of input.analytics?.realtime ?? []) {
      await tx.realtimeMetric.create({
        data: {
          companyId: account.companyId,
          connectedAccountId: account.id,
          platformSlug: account.platformSlug,
          metricKey: metric.metricKey,
          value: metric.value,
          unit: metric.unit ?? 'count',
          observedAt: metric.observedAt,
          metadata: toJsonValue(metric.metadata),
        },
      })
    }

    for (const item of input.analytics?.audience ?? []) {
      await tx.audienceDemographic.upsert({
        where: {
          connectedAccountId_metricDate_dimension_segment: {
            connectedAccountId: account.id,
            metricDate: item.metricDate,
            dimension: item.dimension,
            segment: item.segment,
          },
        },
        update: {
          value: item.value,
          percentage: item.percentage ?? null,
          metadata: toJsonValue(item.metadata),
        },
        create: {
          companyId: account.companyId,
          connectedAccountId: account.id,
          platformSlug: account.platformSlug,
          metricDate: item.metricDate,
          dimension: item.dimension,
          segment: item.segment,
          value: item.value,
          percentage: item.percentage ?? null,
          metadata: toJsonValue(item.metadata),
        },
      })
    }

    for (const metric of input.analytics?.engagement ?? []) {
      const contentPerformanceId = metric.providerContentId ? contentIdByProviderId.get(metric.providerContentId) ?? null : null
      await tx.engagementMetric.upsert({
        where: {
          connectedAccountId_metricDate_granularity_scope_fingerprint: {
            connectedAccountId: account.id,
            metricDate: metric.metricDate,
            granularity: metric.granularity ?? 'day',
            scope: metric.scope ?? 'account',
            fingerprint: metric.fingerprint,
          },
        },
        update: {
          contentPerformanceId,
          views: BigInt(metric.views ?? 0),
          impressions: BigInt(metric.impressions ?? 0),
          likes: BigInt(metric.likes ?? 0),
          comments: BigInt(metric.comments ?? 0),
          shares: BigInt(metric.shares ?? 0),
          saves: BigInt(metric.saves ?? 0),
          clicks: BigInt(metric.clicks ?? 0),
          watchTimeSeconds: BigInt(metric.watchTimeSeconds ?? 0),
          averageViewDuration: metric.averageViewDuration ?? null,
          engagementRate: metric.engagementRate ?? null,
          retentionRate: metric.retentionRate ?? null,
          ctr: metric.ctr ?? null,
          metadata: toJsonValue(metric.metadata),
        },
        create: {
          companyId: account.companyId,
          connectedAccountId: account.id,
          contentPerformanceId,
          platformSlug: account.platformSlug,
          metricDate: metric.metricDate,
          granularity: metric.granularity ?? 'day',
          scope: metric.scope ?? 'account',
          views: BigInt(metric.views ?? 0),
          impressions: BigInt(metric.impressions ?? 0),
          likes: BigInt(metric.likes ?? 0),
          comments: BigInt(metric.comments ?? 0),
          shares: BigInt(metric.shares ?? 0),
          saves: BigInt(metric.saves ?? 0),
          clicks: BigInt(metric.clicks ?? 0),
          watchTimeSeconds: BigInt(metric.watchTimeSeconds ?? 0),
          averageViewDuration: metric.averageViewDuration ?? null,
          engagementRate: metric.engagementRate ?? null,
          retentionRate: metric.retentionRate ?? null,
          ctr: metric.ctr ?? null,
          fingerprint: metric.fingerprint,
          metadata: toJsonValue(metric.metadata),
        },
      })
    }

    for (const metric of input.revenue?.revenue ?? []) {
      const contentPerformanceId = metric.providerContentId ? contentIdByProviderId.get(metric.providerContentId) ?? null : null
      await tx.revenueMetric.upsert({
        where: {
          connectedAccountId_metricDate_granularity_currency_fingerprint: {
            connectedAccountId: account.id,
            metricDate: metric.metricDate,
            granularity: metric.granularity ?? 'day',
            currency: metric.currency ?? 'USD',
            fingerprint: metric.fingerprint,
          },
        },
        update: {
          contentPerformanceId,
          grossRevenue: metric.grossRevenue ?? 0,
          estimatedRevenue: metric.estimatedRevenue ?? 0,
          adRevenue: metric.adRevenue ?? 0,
          subscriptionRevenue: metric.subscriptionRevenue ?? 0,
          affiliateRevenue: metric.affiliateRevenue ?? 0,
          rpm: metric.rpm ?? null,
          cpm: metric.cpm ?? null,
          metadata: toJsonValue(metric.metadata),
        },
        create: {
          companyId: account.companyId,
          connectedAccountId: account.id,
          contentPerformanceId,
          platformSlug: account.platformSlug,
          metricDate: metric.metricDate,
          granularity: metric.granularity ?? 'day',
          currency: metric.currency ?? 'USD',
          grossRevenue: metric.grossRevenue ?? 0,
          estimatedRevenue: metric.estimatedRevenue ?? 0,
          adRevenue: metric.adRevenue ?? 0,
          subscriptionRevenue: metric.subscriptionRevenue ?? 0,
          affiliateRevenue: metric.affiliateRevenue ?? 0,
          rpm: metric.rpm ?? null,
          cpm: metric.cpm ?? null,
          fingerprint: metric.fingerprint,
          metadata: toJsonValue(metric.metadata),
        },
      })
    }

    await tx.connectedAccount.update({
      where: { id: account.id },
      data: {
        lastSyncAt: new Date(),
        syncCursor: input.nextCursor ?? input.analytics?.nextCursor ?? input.content?.nextCursor ?? input.revenue?.nextCursor ?? account.syncCursor,
        healthStatus: 'HEALTHY',
      },
    })
  })
}

export function metricFingerprint(providerSlug: SocialProviderSlug, type: string, value: unknown) {
  return stableHash({ providerSlug, type, value })
}
