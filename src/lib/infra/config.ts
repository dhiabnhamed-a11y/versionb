export const INFRA = {
  commandCenterCacheTtlSec: Number(process.env.COMMAND_CENTER_CACHE_TTL_SEC ?? 45),
  analyticsCacheTtlSec: Number(process.env.ANALYTICS_CACHE_TTL_SEC ?? 60),
  socketHeartbeatMs: Number(process.env.REALTIME_HEARTBEAT_REFRESH_MS ?? 30_000),
  socketPresenceTtlSec: Number(process.env.REALTIME_PRESENCE_TTL_SECONDS ?? 60),
  apiDefaultTimeoutMs: Number(process.env.API_DEFAULT_TIMEOUT_MS ?? 25_000),
  workerConcurrency: {
    realtime: Number(process.env.REALTIME_WORKER_CONCURRENCY ?? 25),
    operations: Number(process.env.QUEUE_CONCURRENCY ?? 5),
  },
  deploy: {
    platform: process.env.DEPLOY_PLATFORM ?? 'cloudflare-opennext',
    realtimeRequired: process.env.NODE_ENV === 'production',
  },
} as const
