export const SOCIAL_PROVIDER_SLUGS = [
  'youtube',
  'spotify',
  'tiktok',
  'instagram',
  'facebook',
  'twitter',
  'twitch',
  'linkedin',
] as const

export type SocialProviderSlug = (typeof SOCIAL_PROVIDER_SLUGS)[number]

export type SocialCapability = 'profile' | 'analytics' | 'revenue' | 'content' | 'realtime' | 'webhooks'

export type SocialProviderCapabilityMap = Record<SocialCapability, boolean>

export type ProviderRequestContext = {
  companyId: string
  userId?: string | null
  accountId?: string | null
  providerSlug: SocialProviderSlug
  priority?: number
  requestId?: string
}

export type ProviderCredentials = {
  clientId: string
  clientSecret?: string
  redirectUri: string
}

export type ProviderAuthorizationInput = {
  state: string
  codeChallenge?: string
  redirectUri: string
  scopes?: string[]
}

export type ProviderAuthorization = {
  url: string
  state: string
  scopes: string[]
}

export type ProviderTokenSet = {
  accessToken: string
  refreshToken?: string | null
  tokenType?: string | null
  scope?: string | null
  scopes?: string[]
  expiresAt?: Date | null
  expiresIn?: number | null
  raw?: unknown
}

export type ProviderTokenInput = {
  accessToken: string
  refreshToken?: string | null
  tokenType?: string | null
  scope?: string | null
  expiresAt?: Date | null
}

export type SocialProfile = {
  providerAccountId: string
  displayName: string
  handle?: string | null
  avatarUrl?: string | null
  accountType?: string
  externalCreatedAt?: Date | null
  metadata?: Record<string, unknown>
}

export type SocialAnalyticsSnapshot = {
  metricDate: Date
  granularity: 'hour' | 'day' | 'week' | 'month'
  metrics: Record<string, number | string | boolean | null>
  dimensions?: Record<string, unknown>
  fingerprint: string
}

export type SocialRealtimeMetric = {
  metricKey: string
  value: number
  unit?: string
  observedAt: Date
  metadata?: Record<string, unknown>
}

export type SocialAudienceDemographic = {
  metricDate: Date
  dimension: string
  segment: string
  value: number
  percentage?: number | null
  metadata?: Record<string, unknown>
}

export type SocialEngagementMetric = {
  metricDate: Date
  granularity?: 'hour' | 'day' | 'week' | 'month'
  scope?: 'account' | 'content'
  providerContentId?: string | null
  views?: bigint | number
  impressions?: bigint | number
  likes?: bigint | number
  comments?: bigint | number
  shares?: bigint | number
  saves?: bigint | number
  clicks?: bigint | number
  watchTimeSeconds?: bigint | number
  averageViewDuration?: number | null
  engagementRate?: number | null
  retentionRate?: number | null
  ctr?: number | null
  fingerprint: string
  metadata?: Record<string, unknown>
}

export type SocialRevenueMetric = {
  metricDate: Date
  granularity?: 'day' | 'week' | 'month'
  providerContentId?: string | null
  currency?: string
  grossRevenue?: number
  estimatedRevenue?: number
  adRevenue?: number
  subscriptionRevenue?: number
  affiliateRevenue?: number
  rpm?: number | null
  cpm?: number | null
  fingerprint: string
  metadata?: Record<string, unknown>
}

export type SocialContentItem = {
  providerContentId: string
  contentType: string
  title: string
  description?: string | null
  url?: string | null
  thumbnailUrl?: string | null
  publishedAt?: Date | null
  durationSeconds?: number | null
  metrics?: Record<string, unknown>
  revenue?: Record<string, unknown>
}

export type ProviderSyncCursor = {
  cursor?: string | null
  since?: Date | null
  until?: Date | null
}

export type ProviderAnalyticsResult = {
  snapshots?: SocialAnalyticsSnapshot[]
  realtime?: SocialRealtimeMetric[]
  audience?: SocialAudienceDemographic[]
  engagement?: SocialEngagementMetric[]
  nextCursor?: string | null
  raw?: unknown
}

export type ProviderRevenueResult = {
  revenue?: SocialRevenueMetric[]
  nextCursor?: string | null
  raw?: unknown
}

export type ProviderContentResult = {
  content?: SocialContentItem[]
  nextCursor?: string | null
  raw?: unknown
}

export type ProviderSyncResult = {
  profile?: SocialProfile
  analytics?: ProviderAnalyticsResult
  revenue?: ProviderRevenueResult
  content?: ProviderContentResult
  webhookRegistration?: ProviderWebhookRegistrationResult
  nextCursor?: string | null
}

export type ProviderWebhookRegistrationResult = {
  registered: boolean
  externalSubscriptionId?: string | null
  expiresAt?: Date | null
  metadata?: Record<string, unknown>
}

export interface SocialProvider {
  readonly slug: SocialProviderSlug
  readonly displayName: string
  readonly requiredScopes: readonly string[]
  readonly optionalScopes: readonly string[]
  readonly capabilities: SocialProviderCapabilityMap

  connect(input: ProviderAuthorizationInput): Promise<ProviderAuthorization>
  disconnect(input: { tokens: ProviderTokenInput; context: ProviderRequestContext }): Promise<void>
  exchangeCode(input: {
    code: string
    codeVerifier?: string | null
    redirectUri: string
    context: ProviderRequestContext
  }): Promise<ProviderTokenSet>
  refreshToken(input: { tokens: ProviderTokenInput; context: ProviderRequestContext }): Promise<ProviderTokenSet>
  fetchProfile(input: { tokens: ProviderTokenInput; context: ProviderRequestContext }): Promise<SocialProfile>
  fetchAnalytics(input: {
    tokens: ProviderTokenInput
    cursor?: ProviderSyncCursor
    context: ProviderRequestContext
  }): Promise<ProviderAnalyticsResult>
  fetchRevenue(input: {
    tokens: ProviderTokenInput
    cursor?: ProviderSyncCursor
    context: ProviderRequestContext
  }): Promise<ProviderRevenueResult>
  fetchContent(input: {
    tokens: ProviderTokenInput
    cursor?: ProviderSyncCursor
    context: ProviderRequestContext
  }): Promise<ProviderContentResult>
  registerWebhooks(input: {
    tokens: ProviderTokenInput
    account: SocialProfile
    callbackUrl: string
    context: ProviderRequestContext
  }): Promise<ProviderWebhookRegistrationResult>
  sync(input: {
    tokens: ProviderTokenInput
    cursor?: ProviderSyncCursor
    context: ProviderRequestContext
  }): Promise<ProviderSyncResult>
}
