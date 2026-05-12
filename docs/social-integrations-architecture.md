# Social Integrations Architecture

## 1. Folder Structure

```txt
src/modules/integrations
  core                 Provider contracts, registry, provider metadata, typed errors
  providers            YouTube, Spotify, TikTok, Meta, X/Twitter, Twitch, LinkedIn adapters
  repositories         Prisma persistence boundary for accounts, tokens, metrics, jobs
  services             OAuth, sync engine, analytics aggregation, AI insights, rate limiting
  jobs                 BullMQ job names, enqueue helpers, worker handlers
  webhooks             Signature validation, event ingestion, webhook processing
  cache                Redis client and JSON cache helpers
  security             OAuth state, token encryption, RBAC, audit logging
  utils                Hashing, date windows, normalization helpers
```

## 2. Provider Architecture

Every platform implements `SocialProvider` in `src/modules/integrations/core/types.ts`:

```ts
connect()
disconnect()
refreshToken()
fetchProfile()
fetchAnalytics()
fetchRevenue()
fetchContent()
registerWebhooks()
sync()
```

`provider-registry.ts` is the plug-in point. Future providers are added by creating an adapter and registering it once.

## 3. Prisma Schemas

The migration `20260512130000_social_integrations_engine` adds:

`social_platforms`, `connected_accounts`, `provider_tokens`, `creator_profiles`, `analytics_snapshots`, `realtime_metrics`, `audience_demographics`, `engagement_metrics`, `revenue_metrics`, `content_performance`, `ai_insights`, `sync_jobs`, `webhook_events`, and `integration_activity_logs`.

High-volume tables include tenant, platform, account, and date indexes plus BRIN date indexes. Production partitioning strategy: monthly RANGE partitions on `metricDate` or `observedAt` for `analytics_snapshots`, `engagement_metrics`, `revenue_metrics`, `audience_demographics`, and short-retention `realtime_metrics`.

## 4. Queue Architecture

BullMQ queue: `social-integrations`

Jobs:
`social.analytics.sync`, `social.token.refresh`, `social.webhook.process`, `social.ai-insights.generate`, `social.realtime.update`.

Retries use exponential backoff from the shared queue layer. Final failures are marked through `JobRun` and `sync_jobs` as `DEAD_LETTER` or provider-specific failure states.

## 5. OAuth Flow

Routes:

`GET /api/integrations/oauth/[provider]/start`
`GET /api/integrations/oauth/[provider]/callback`

The flow uses signed state, PKCE, an HttpOnly SameSite cookie, tenant/user/provider binding, encrypted token storage with AES-256-GCM, audit logs, initial sync enqueueing, and webhook registration attempts.

## 6. Redis Caching

Redis is used for dashboard JSON cache and provider-aware rate limits. If Redis is not configured, the module degrades to short-lived in-process cache for local development.

## 7. Sync Engine

`sync-engine.service.ts` centralizes:

- incremental/full sync windows
- token refresh before provider calls
- provider adapter execution
- deduped upserts by account/date/fingerprint/content id
- sync job status updates
- realtime dashboard invalidation
- AI insight job chaining

## 8. Webhook System

`POST /api/integrations/webhooks/[provider]` stores raw provider payloads, validates HMAC signatures when provider secrets are configured, deduplicates by provider event id, maps events to connected accounts, and queues webhook processing.

## 9. Realtime Architecture

New workspace events:

`social_account_connected`, `social_account_disconnected`, `social_sync_completed`, `social_metrics_updated`, `social_insight_created`, `social_webhook_processed`.

The existing Socket.IO/Supabase/polling abstraction broadcasts dashboard updates without coupling provider workers to UI components.

## 10. API Routes

- `/api/integrations/providers`
- `/api/integrations/accounts`
- `/api/integrations/accounts/[id]`
- `/api/integrations/accounts/[id]/sync`
- `/api/integrations/analytics/overview`
- `/api/integrations/oauth/[provider]/start`
- `/api/integrations/oauth/[provider]/callback`
- `/api/integrations/webhooks/[provider]`

## 11. Service Layer

API routes call services only. Services call repositories/providers. Providers never write to Prisma directly.

## 12. Frontend Dashboard

Route: `/dashboard/admin/social-analytics`

Tabs cover overview, YouTube, Spotify, audience, revenue, content, growth, realtime, creators, and connected accounts. Zustand owns tab/provider/window state. Recharts renders trend, platform, and revenue charts from real stored metrics.

## 13. Security

- OAuth CSRF and PKCE
- encrypted token envelopes
- owner/manager-only integration management
- company isolation on every query
- audit and integration activity logs
- webhook signature validation hooks
- token refresh failure health states

## 14. Scaling Strategy

- queue workers are horizontally scalable
- metrics are append/upsert facts, not dashboard-shaped blobs
- dashboard reads use Redis cached aggregates
- raw realtime metrics should be short-retention and rolled into snapshots
- high-volume facts should be partitioned monthly once write volume grows

## 15. Deployment Architecture

Recommended services:

- Next.js app on Vercel or Node host
- custom `server.ts` host when Socket.IO is required
- separate worker process running the same codebase for BullMQ
- Postgres primary with partition maintenance
- Redis for BullMQ, rate limits, and cache
- Cloudflare in front for WAF, bot controls, webhook ingress rules

## 16. Monitoring Architecture

Track:

- queue latency, retries, dead-letter counts
- provider quota/cooldown counters
- OAuth failures by provider
- token refresh failure counts
- webhook invalid signature rates
- sync duration and rows written
- dashboard cache hit rate

## 17. AI Insights Architecture

`ai-insights.service.ts` generates grounded recommendations from stored engagement, revenue, publishing cadence, and content records. It writes auditable `ai_insights` rows and emits realtime insight events. The deterministic layer can be upgraded to an OpenAI summarization pass without changing provider or repository contracts.
