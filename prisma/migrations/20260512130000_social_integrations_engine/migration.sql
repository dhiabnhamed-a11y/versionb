-- Social integrations engine for content-creator workspaces.
-- Tables are intentionally snake_case because these tables form an integration
-- boundary shared by API routes, workers, webhooks, analytics, and future ETL.

CREATE TABLE "social_platforms" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "authType" TEXT NOT NULL DEFAULT 'oauth2',
  "capabilities" JSONB NOT NULL,
  "requiredScopes" TEXT[] NOT NULL,
  "optionalScopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "social_platforms_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "social_platforms_slug_key" ON "social_platforms"("slug");
CREATE INDEX "social_platforms_status_slug_idx" ON "social_platforms"("status", "slug");

CREATE TABLE "creator_profiles" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "ownerUserId" TEXT,
  "displayName" TEXT NOT NULL,
  "legalName" TEXT,
  "primaryEmail" TEXT,
  "avatarUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "creator_profiles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "creator_profiles_companyId_status_createdAt_idx" ON "creator_profiles"("companyId", "status", "createdAt");
CREATE INDEX "creator_profiles_companyId_displayName_idx" ON "creator_profiles"("companyId", "displayName");
CREATE INDEX "creator_profiles_ownerUserId_status_idx" ON "creator_profiles"("ownerUserId", "status");

ALTER TABLE "creator_profiles"
  ADD CONSTRAINT "creator_profiles_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "creator_profiles"
  ADD CONSTRAINT "creator_profiles_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "connected_accounts" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "platformId" TEXT NOT NULL,
  "platformSlug" TEXT NOT NULL,
  "creatorProfileId" TEXT,
  "connectedById" TEXT,
  "providerAccountId" TEXT NOT NULL,
  "handle" TEXT,
  "displayName" TEXT NOT NULL,
  "avatarUrl" TEXT,
  "accountType" TEXT NOT NULL DEFAULT 'PROFILE',
  "status" TEXT NOT NULL DEFAULT 'CONNECTED',
  "healthStatus" TEXT NOT NULL DEFAULT 'HEALTHY',
  "scopes" TEXT[] NOT NULL,
  "metadata" JSONB,
  "syncCursor" TEXT,
  "lastSyncAt" TIMESTAMP(3),
  "externalCreatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "connected_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "connected_accounts_companyId_platformId_providerAccountId_key"
  ON "connected_accounts"("companyId", "platformId", "providerAccountId");
CREATE INDEX "connected_accounts_companyId_status_updatedAt_idx" ON "connected_accounts"("companyId", "status", "updatedAt");
CREATE INDEX "connected_accounts_companyId_platformSlug_status_idx" ON "connected_accounts"("companyId", "platformSlug", "status");
CREATE INDEX "connected_accounts_creatorProfileId_status_idx" ON "connected_accounts"("creatorProfileId", "status");
CREATE INDEX "connected_accounts_lastSyncAt_idx" ON "connected_accounts"("lastSyncAt");

ALTER TABLE "connected_accounts"
  ADD CONSTRAINT "connected_accounts_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "connected_accounts"
  ADD CONSTRAINT "connected_accounts_platformId_fkey"
  FOREIGN KEY ("platformId") REFERENCES "social_platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "connected_accounts"
  ADD CONSTRAINT "connected_accounts_creatorProfileId_fkey"
  FOREIGN KEY ("creatorProfileId") REFERENCES "creator_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "connected_accounts"
  ADD CONSTRAINT "connected_accounts_connectedById_fkey"
  FOREIGN KEY ("connectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "provider_tokens" (
  "id" TEXT NOT NULL,
  "connectedAccountId" TEXT NOT NULL,
  "accessTokenCiphertext" TEXT NOT NULL,
  "refreshTokenCiphertext" TEXT,
  "tokenType" TEXT NOT NULL DEFAULT 'Bearer',
  "scope" TEXT,
  "expiresAt" TIMESTAMP(3),
  "rotationVersion" INTEGER NOT NULL DEFAULT 1,
  "lastRefreshedAt" TIMESTAMP(3),
  "refreshFailureCount" INTEGER NOT NULL DEFAULT 0,
  "revokedAt" TIMESTAMP(3),
  "keyId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "provider_tokens_connectedAccountId_key" ON "provider_tokens"("connectedAccountId");
CREATE INDEX "provider_tokens_expiresAt_idx" ON "provider_tokens"("expiresAt");
CREATE INDEX "provider_tokens_revokedAt_idx" ON "provider_tokens"("revokedAt");

ALTER TABLE "provider_tokens"
  ADD CONSTRAINT "provider_tokens_connectedAccountId_fkey"
  FOREIGN KEY ("connectedAccountId") REFERENCES "connected_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "analytics_snapshots" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "connectedAccountId" TEXT NOT NULL,
  "platformSlug" TEXT NOT NULL,
  "metricDate" TIMESTAMP(3) NOT NULL,
  "granularity" TEXT NOT NULL DEFAULT 'day',
  "syncJobId" TEXT,
  "metrics" JSONB NOT NULL,
  "dimensions" JSONB,
  "fingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "analytics_snapshots_connectedAccountId_metricDate_granularity_fingerprint_key"
  ON "analytics_snapshots"("connectedAccountId", "metricDate", "granularity", "fingerprint");
CREATE INDEX "analytics_snapshots_companyId_platformSlug_metricDate_idx"
  ON "analytics_snapshots"("companyId", "platformSlug", "metricDate");
CREATE INDEX "analytics_snapshots_connectedAccountId_metricDate_idx" ON "analytics_snapshots"("connectedAccountId", "metricDate");
CREATE INDEX "analytics_snapshots_syncJobId_idx" ON "analytics_snapshots"("syncJobId");
CREATE INDEX "analytics_snapshots_metricDate_brin_idx" ON "analytics_snapshots" USING BRIN ("metricDate");

ALTER TABLE "analytics_snapshots"
  ADD CONSTRAINT "analytics_snapshots_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "analytics_snapshots"
  ADD CONSTRAINT "analytics_snapshots_connectedAccountId_fkey"
  FOREIGN KEY ("connectedAccountId") REFERENCES "connected_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "realtime_metrics" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "connectedAccountId" TEXT NOT NULL,
  "platformSlug" TEXT NOT NULL,
  "metricKey" TEXT NOT NULL,
  "value" DECIMAL(20,6) NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'count',
  "observedAt" TIMESTAMP(3) NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "realtime_metrics_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "realtime_metrics_companyId_platformSlug_observedAt_idx" ON "realtime_metrics"("companyId", "platformSlug", "observedAt");
CREATE INDEX "realtime_metrics_connectedAccountId_metricKey_observedAt_idx" ON "realtime_metrics"("connectedAccountId", "metricKey", "observedAt");
CREATE INDEX "realtime_metrics_observedAt_brin_idx" ON "realtime_metrics" USING BRIN ("observedAt");

ALTER TABLE "realtime_metrics"
  ADD CONSTRAINT "realtime_metrics_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "realtime_metrics"
  ADD CONSTRAINT "realtime_metrics_connectedAccountId_fkey"
  FOREIGN KEY ("connectedAccountId") REFERENCES "connected_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "audience_demographics" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "connectedAccountId" TEXT NOT NULL,
  "platformSlug" TEXT NOT NULL,
  "metricDate" TIMESTAMP(3) NOT NULL,
  "dimension" TEXT NOT NULL,
  "segment" TEXT NOT NULL,
  "value" DECIMAL(20,6) NOT NULL,
  "percentage" DECIMAL(8,4),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "audience_demographics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "audience_demographics_connectedAccountId_metricDate_dimension_segment_key"
  ON "audience_demographics"("connectedAccountId", "metricDate", "dimension", "segment");
CREATE INDEX "audience_demographics_companyId_platformSlug_metricDate_idx" ON "audience_demographics"("companyId", "platformSlug", "metricDate");
CREATE INDEX "audience_demographics_dimension_segment_idx" ON "audience_demographics"("dimension", "segment");
CREATE INDEX "audience_demographics_metricDate_brin_idx" ON "audience_demographics" USING BRIN ("metricDate");

ALTER TABLE "audience_demographics"
  ADD CONSTRAINT "audience_demographics_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audience_demographics"
  ADD CONSTRAINT "audience_demographics_connectedAccountId_fkey"
  FOREIGN KEY ("connectedAccountId") REFERENCES "connected_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "content_performance" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "connectedAccountId" TEXT NOT NULL,
  "platformSlug" TEXT NOT NULL,
  "providerContentId" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "url" TEXT,
  "thumbnailUrl" TEXT,
  "publishedAt" TIMESTAMP(3),
  "durationSeconds" INTEGER,
  "metrics" JSONB,
  "revenue" JSONB,
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "content_performance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "content_performance_connectedAccountId_providerContentId_key"
  ON "content_performance"("connectedAccountId", "providerContentId");
CREATE INDEX "content_performance_companyId_platformSlug_publishedAt_idx" ON "content_performance"("companyId", "platformSlug", "publishedAt");
CREATE INDEX "content_performance_connectedAccountId_lastSyncedAt_idx" ON "content_performance"("connectedAccountId", "lastSyncedAt");

ALTER TABLE "content_performance"
  ADD CONSTRAINT "content_performance_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "content_performance"
  ADD CONSTRAINT "content_performance_connectedAccountId_fkey"
  FOREIGN KEY ("connectedAccountId") REFERENCES "connected_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "engagement_metrics" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "connectedAccountId" TEXT NOT NULL,
  "contentPerformanceId" TEXT,
  "platformSlug" TEXT NOT NULL,
  "metricDate" TIMESTAMP(3) NOT NULL,
  "granularity" TEXT NOT NULL DEFAULT 'day',
  "scope" TEXT NOT NULL DEFAULT 'account',
  "views" BIGINT NOT NULL DEFAULT 0,
  "impressions" BIGINT NOT NULL DEFAULT 0,
  "likes" BIGINT NOT NULL DEFAULT 0,
  "comments" BIGINT NOT NULL DEFAULT 0,
  "shares" BIGINT NOT NULL DEFAULT 0,
  "saves" BIGINT NOT NULL DEFAULT 0,
  "clicks" BIGINT NOT NULL DEFAULT 0,
  "watchTimeSeconds" BIGINT NOT NULL DEFAULT 0,
  "averageViewDuration" DECIMAL(20,6),
  "engagementRate" DECIMAL(8,4),
  "retentionRate" DECIMAL(8,4),
  "ctr" DECIMAL(8,4),
  "fingerprint" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "engagement_metrics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "engagement_metrics_connectedAccountId_metricDate_granularity_scope_fingerprint_key"
  ON "engagement_metrics"("connectedAccountId", "metricDate", "granularity", "scope", "fingerprint");
CREATE INDEX "engagement_metrics_companyId_platformSlug_metricDate_idx" ON "engagement_metrics"("companyId", "platformSlug", "metricDate");
CREATE INDEX "engagement_metrics_connectedAccountId_metricDate_idx" ON "engagement_metrics"("connectedAccountId", "metricDate");
CREATE INDEX "engagement_metrics_contentPerformanceId_metricDate_idx" ON "engagement_metrics"("contentPerformanceId", "metricDate");
CREATE INDEX "engagement_metrics_metricDate_brin_idx" ON "engagement_metrics" USING BRIN ("metricDate");

ALTER TABLE "engagement_metrics"
  ADD CONSTRAINT "engagement_metrics_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "engagement_metrics"
  ADD CONSTRAINT "engagement_metrics_connectedAccountId_fkey"
  FOREIGN KEY ("connectedAccountId") REFERENCES "connected_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "engagement_metrics"
  ADD CONSTRAINT "engagement_metrics_contentPerformanceId_fkey"
  FOREIGN KEY ("contentPerformanceId") REFERENCES "content_performance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "revenue_metrics" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "connectedAccountId" TEXT NOT NULL,
  "contentPerformanceId" TEXT,
  "platformSlug" TEXT NOT NULL,
  "metricDate" TIMESTAMP(3) NOT NULL,
  "granularity" TEXT NOT NULL DEFAULT 'day',
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "grossRevenue" DECIMAL(20,6) NOT NULL DEFAULT 0,
  "estimatedRevenue" DECIMAL(20,6) NOT NULL DEFAULT 0,
  "adRevenue" DECIMAL(20,6) NOT NULL DEFAULT 0,
  "subscriptionRevenue" DECIMAL(20,6) NOT NULL DEFAULT 0,
  "affiliateRevenue" DECIMAL(20,6) NOT NULL DEFAULT 0,
  "rpm" DECIMAL(20,6),
  "cpm" DECIMAL(20,6),
  "fingerprint" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "revenue_metrics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "revenue_metrics_connectedAccountId_metricDate_granularity_currency_fingerprint_key"
  ON "revenue_metrics"("connectedAccountId", "metricDate", "granularity", "currency", "fingerprint");
CREATE INDEX "revenue_metrics_companyId_platformSlug_metricDate_idx" ON "revenue_metrics"("companyId", "platformSlug", "metricDate");
CREATE INDEX "revenue_metrics_connectedAccountId_metricDate_idx" ON "revenue_metrics"("connectedAccountId", "metricDate");
CREATE INDEX "revenue_metrics_contentPerformanceId_metricDate_idx" ON "revenue_metrics"("contentPerformanceId", "metricDate");
CREATE INDEX "revenue_metrics_metricDate_brin_idx" ON "revenue_metrics" USING BRIN ("metricDate");

ALTER TABLE "revenue_metrics"
  ADD CONSTRAINT "revenue_metrics_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "revenue_metrics"
  ADD CONSTRAINT "revenue_metrics_connectedAccountId_fkey"
  FOREIGN KEY ("connectedAccountId") REFERENCES "connected_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "revenue_metrics"
  ADD CONSTRAINT "revenue_metrics_contentPerformanceId_fkey"
  FOREIGN KEY ("contentPerformanceId") REFERENCES "content_performance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ai_insights" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "creatorProfileId" TEXT,
  "connectedAccountId" TEXT,
  "insightType" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'INFO',
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "recommendation" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
  "evidence" JSONB,
  "model" TEXT NOT NULL DEFAULT 'deterministic-social-intelligence',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_insights_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_insights_companyId_status_generatedAt_idx" ON "ai_insights"("companyId", "status", "generatedAt");
CREATE INDEX "ai_insights_connectedAccountId_generatedAt_idx" ON "ai_insights"("connectedAccountId", "generatedAt");
CREATE INDEX "ai_insights_creatorProfileId_generatedAt_idx" ON "ai_insights"("creatorProfileId", "generatedAt");

ALTER TABLE "ai_insights"
  ADD CONSTRAINT "ai_insights_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_insights"
  ADD CONSTRAINT "ai_insights_creatorProfileId_fkey"
  FOREIGN KEY ("creatorProfileId") REFERENCES "creator_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_insights"
  ADD CONSTRAINT "ai_insights_connectedAccountId_fkey"
  FOREIGN KEY ("connectedAccountId") REFERENCES "connected_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sync_jobs" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "connectedAccountId" TEXT,
  "providerSlug" TEXT NOT NULL,
  "jobType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "priority" INTEGER NOT NULL DEFAULT 50,
  "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "cursor" TEXT,
  "payload" JSONB,
  "result" JSONB,
  "error" TEXT,
  "lockedUntil" TIMESTAMP(3),
  "jobRunId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sync_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sync_jobs_jobRunId_key" ON "sync_jobs"("jobRunId");
CREATE INDEX "sync_jobs_status_scheduledFor_priority_idx" ON "sync_jobs"("status", "scheduledFor", "priority");
CREATE INDEX "sync_jobs_companyId_providerSlug_createdAt_idx" ON "sync_jobs"("companyId", "providerSlug", "createdAt");
CREATE INDEX "sync_jobs_connectedAccountId_status_scheduledFor_idx" ON "sync_jobs"("connectedAccountId", "status", "scheduledFor");
CREATE INDEX "sync_jobs_jobRunId_idx" ON "sync_jobs"("jobRunId");

ALTER TABLE "sync_jobs"
  ADD CONSTRAINT "sync_jobs_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sync_jobs"
  ADD CONSTRAINT "sync_jobs_connectedAccountId_fkey"
  FOREIGN KEY ("connectedAccountId") REFERENCES "connected_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "webhook_events" (
  "id" TEXT NOT NULL,
  "companyId" TEXT,
  "connectedAccountId" TEXT,
  "providerSlug" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "providerEventId" TEXT,
  "signatureValid" BOOLEAN NOT NULL DEFAULT false,
  "processingStatus" TEXT NOT NULL DEFAULT 'RECEIVED',
  "payload" JSONB NOT NULL,
  "headers" JSONB,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "webhook_events_providerSlug_providerEventId_key" ON "webhook_events"("providerSlug", "providerEventId");
CREATE INDEX "webhook_events_providerSlug_processingStatus_receivedAt_idx" ON "webhook_events"("providerSlug", "processingStatus", "receivedAt");
CREATE INDEX "webhook_events_companyId_receivedAt_idx" ON "webhook_events"("companyId", "receivedAt");
CREATE INDEX "webhook_events_connectedAccountId_receivedAt_idx" ON "webhook_events"("connectedAccountId", "receivedAt");

ALTER TABLE "webhook_events"
  ADD CONSTRAINT "webhook_events_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "webhook_events"
  ADD CONSTRAINT "webhook_events_connectedAccountId_fkey"
  FOREIGN KEY ("connectedAccountId") REFERENCES "connected_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "integration_activity_logs" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "connectedAccountId" TEXT,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'INFO',
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "integration_activity_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "integration_activity_logs_companyId_createdAt_idx" ON "integration_activity_logs"("companyId", "createdAt");
CREATE INDEX "integration_activity_logs_connectedAccountId_createdAt_idx" ON "integration_activity_logs"("connectedAccountId", "createdAt");
CREATE INDEX "integration_activity_logs_actorId_createdAt_idx" ON "integration_activity_logs"("actorId", "createdAt");
CREATE INDEX "integration_activity_logs_action_createdAt_idx" ON "integration_activity_logs"("action", "createdAt");

ALTER TABLE "integration_activity_logs"
  ADD CONSTRAINT "integration_activity_logs_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "integration_activity_logs"
  ADD CONSTRAINT "integration_activity_logs_connectedAccountId_fkey"
  FOREIGN KEY ("connectedAccountId") REFERENCES "connected_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "integration_activity_logs"
  ADD CONSTRAINT "integration_activity_logs_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMENT ON TABLE "analytics_snapshots" IS 'High-volume social analytics facts. For enterprise installations, convert to monthly RANGE partitions by metricDate and keep the same company/platform/date indexes on each partition.';
COMMENT ON TABLE "engagement_metrics" IS 'High-volume engagement facts. Use monthly RANGE partitions by metricDate once rows exceed operational OLTP thresholds.';
COMMENT ON TABLE "revenue_metrics" IS 'High-volume monetization facts. Use monthly RANGE partitions by metricDate and currency-aware rollups for dashboard reads.';
COMMENT ON TABLE "realtime_metrics" IS 'Short-retention live facts. Retain raw rows for 7-30 days, aggregate into analytics_snapshots, then expire.';

INSERT INTO "social_platforms" (
  "id",
  "slug",
  "displayName",
  "category",
  "capabilities",
  "requiredScopes",
  "optionalScopes",
  "status",
  "createdAt",
  "updatedAt"
) VALUES
  (
    'social_platform_youtube',
    'youtube',
    'YouTube',
    'video',
    '{"profile":true,"analytics":true,"revenue":true,"content":true,"realtime":true,"webhooks":true}'::jsonb,
    ARRAY['https://www.googleapis.com/auth/youtube.readonly','https://www.googleapis.com/auth/yt-analytics.readonly'],
    ARRAY['https://www.googleapis.com/auth/yt-analytics-monetary.readonly'],
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'social_platform_spotify',
    'spotify',
    'Spotify',
    'audio',
    '{"profile":true,"analytics":true,"revenue":false,"content":true,"realtime":false,"webhooks":false}'::jsonb,
    ARRAY['user-read-private','user-read-email'],
    ARRAY['user-top-read'],
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'social_platform_tiktok',
    'tiktok',
    'TikTok',
    'short_video',
    '{"profile":true,"analytics":true,"revenue":false,"content":true,"realtime":true,"webhooks":true}'::jsonb,
    ARRAY['user.info.basic','video.list'],
    ARRAY['video.insights'],
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'social_platform_instagram',
    'instagram',
    'Instagram',
    'social',
    '{"profile":true,"analytics":true,"revenue":false,"content":true,"realtime":true,"webhooks":true}'::jsonb,
    ARRAY['instagram_basic','pages_show_list'],
    ARRAY['instagram_manage_insights'],
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'social_platform_facebook',
    'facebook',
    'Facebook',
    'social',
    '{"profile":true,"analytics":true,"revenue":false,"content":true,"realtime":true,"webhooks":true}'::jsonb,
    ARRAY['public_profile','pages_show_list'],
    ARRAY['read_insights'],
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'social_platform_twitter',
    'twitter',
    'X / Twitter',
    'social',
    '{"profile":true,"analytics":true,"revenue":false,"content":true,"realtime":true,"webhooks":true}'::jsonb,
    ARRAY['tweet.read','users.read','offline.access'],
    ARRAY['follows.read'],
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'social_platform_twitch',
    'twitch',
    'Twitch',
    'streaming',
    '{"profile":true,"analytics":true,"revenue":true,"content":true,"realtime":true,"webhooks":true}'::jsonb,
    ARRAY['user:read:email','analytics:read:games','analytics:read:extensions'],
    ARRAY['channel:read:subscriptions'],
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'social_platform_linkedin',
    'linkedin',
    'LinkedIn',
    'professional',
    '{"profile":true,"analytics":true,"revenue":false,"content":true,"realtime":false,"webhooks":true}'::jsonb,
    ARRAY['openid','profile','email'],
    ARRAY['w_member_social'],
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("slug") DO NOTHING;
