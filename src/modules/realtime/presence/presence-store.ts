import type { Redis } from 'ioredis'
import { getRealtimeRedis } from '@/modules/realtime/adapters/redis'
import { recordRealtimeMetric } from '@/modules/realtime/metrics/metrics'
import { logger } from '@/modules/shared/logger'

export type PresenceUser = {
  id: string
  name?: string | null
  role?: string | null
  companyId?: string | null
}

export type PresenceSnapshotEntry = {
  userId: string
  name: string | null
  role: string | null
  companyId: string | null
  online: boolean
  activeChannelId: string | null
  deviceCount: number
  lastSeenAt: string
  at: string
}

type LocalPresenceEntry = {
  user: PresenceUser
  sockets: Set<string>
  activeChannelId: string | null
  lastSeenAt: string
}

const localPresence = globalThis as typeof globalThis & {
  __taskitLocalPresence?: Map<string, LocalPresenceEntry>
}

const PRESENCE_TTL_SECONDS = Math.max(Number(process.env.REALTIME_PRESENCE_TTL_SECONDS ?? 45), 15)
const HEARTBEAT_TTL_SECONDS = Math.max(Number(process.env.REALTIME_HEARTBEAT_TTL_SECONDS ?? 35), 10)

function localStore() {
  if (!localPresence.__taskitLocalPresence) localPresence.__taskitLocalPresence = new Map()
  return localPresence.__taskitLocalPresence
}

function workspaceUsersKey(workspaceId: string) {
  return `taskit:presence:workspace:${workspaceId}:users`
}

function userSocketsKey(userId: string) {
  return `taskit:presence:user:${userId}:sockets`
}

function userKey(userId: string) {
  return `taskit:presence:user:${userId}`
}

function socketKey(socketId: string) {
  return `taskit:presence:socket:${socketId}`
}

function socketHeartbeatKey(socketId: string) {
  return `taskit:presence:heartbeat:${socketId}`
}

function typingKey(workspaceId: string, channelId: string, userId: string) {
  return `taskit:presence:typing:${workspaceId}:${channelId}:${userId}`
}

function serializeNullable(value: string | null | undefined) {
  return value ?? ''
}

function deserializeNullable(value: string | undefined) {
  return value ? value : null
}

function fallbackConnect(user: PresenceUser, socketId: string) {
  const store = localStore()
  const existing = store.get(user.id)
  const wasOffline = !existing
  if (existing) {
    existing.sockets.add(socketId)
    existing.lastSeenAt = new Date().toISOString()
  } else {
    store.set(user.id, { user, sockets: new Set([socketId]), activeChannelId: null, lastSeenAt: new Date().toISOString() })
  }
  return wasOffline
}

async function hasLiveSockets(redis: Redis, userId: string) {
  const socketIds = await redis.smembers(userSocketsKey(userId))
  if (!socketIds.length) return false

  const heartbeatKeys = socketIds.map(socketHeartbeatKey)
  const exists = await redis.mget(...heartbeatKeys)
  const liveSocketIds = socketIds.filter((_socketId, index) => Boolean(exists[index]))
  const staleSocketIds = socketIds.filter((_socketId, index) => !exists[index])

  if (staleSocketIds.length) {
    await redis.srem(userSocketsKey(userId), ...staleSocketIds)
  }

  return liveSocketIds.length > 0
}

export async function markSocketConnected(user: PresenceUser, socketId: string, instanceId: string) {
  const redis = getRealtimeRedis()
  if (!redis || !user.companyId) return fallbackConnect(user, socketId)

  const wasOnline = await hasLiveSockets(redis, user.id)
  const now = new Date().toISOString()

  await redis
    .multi()
    .sadd(workspaceUsersKey(user.companyId), user.id)
    .sadd(userSocketsKey(user.id), socketId)
    .expire(userSocketsKey(user.id), PRESENCE_TTL_SECONDS)
    .hset(userKey(user.id), {
      id: user.id,
      name: serializeNullable(user.name),
      role: serializeNullable(user.role),
      companyId: serializeNullable(user.companyId),
      activeChannelId: '',
      lastSeenAt: now,
    })
    .expire(userKey(user.id), PRESENCE_TTL_SECONDS)
    .hset(socketKey(socketId), { userId: user.id, companyId: user.companyId, instanceId, connectedAt: now })
    .expire(socketKey(socketId), HEARTBEAT_TTL_SECONDS)
    .set(socketHeartbeatKey(socketId), now, 'EX', HEARTBEAT_TTL_SECONDS)
    .exec()

  if (!wasOnline) recordRealtimeMetric('presence.online', { userId: user.id, workspaceId: user.companyId })
  return !wasOnline
}

export async function refreshSocketHeartbeat(socketId: string) {
  const redis = getRealtimeRedis()
  if (!redis) return

  const now = new Date().toISOString()
  const socket = await redis.hgetall(socketKey(socketId))
  if (!socket.userId) return

  await redis
    .multi()
    .set(socketHeartbeatKey(socketId), now, 'EX', HEARTBEAT_TTL_SECONDS)
    .expire(socketKey(socketId), HEARTBEAT_TTL_SECONDS)
    .expire(userSocketsKey(socket.userId), PRESENCE_TTL_SECONDS)
    .expire(userKey(socket.userId), PRESENCE_TTL_SECONDS)
    .hset(userKey(socket.userId), { lastSeenAt: now })
    .exec()
}

export async function markActiveChannel(socketId: string, channelId: string | null) {
  const redis = getRealtimeRedis()
  const now = new Date().toISOString()

  if (!redis) {
    const store = localStore()
    for (const entry of store.values()) {
      if (entry.sockets.has(socketId)) {
        entry.activeChannelId = channelId
        entry.lastSeenAt = now
        return
      }
    }
    return
  }

  const socket = await redis.hgetall(socketKey(socketId))
  if (!socket.userId) return
  await redis.hset(userKey(socket.userId), { activeChannelId: channelId ?? '', lastSeenAt: now })
}

export async function markSocketDisconnected(user: PresenceUser, socketId: string) {
  const redis = getRealtimeRedis()
  const now = new Date().toISOString()

  if (!redis || !user.companyId) {
    const store = localStore()
    const current = store.get(user.id)
    if (!current) return false
    current.sockets.delete(socketId)
    current.lastSeenAt = now
    if (current.sockets.size > 0) return false
    store.delete(user.id)
    return true
  }

  await redis
    .multi()
    .srem(userSocketsKey(user.id), socketId)
    .del(socketKey(socketId))
    .del(socketHeartbeatKey(socketId))
    .hset(userKey(user.id), { lastSeenAt: now })
    .exec()

  const stillOnline = await hasLiveSockets(redis, user.id)
  if (stillOnline) return false

  await redis
    .multi()
    .srem(workspaceUsersKey(user.companyId), user.id)
    .expire(userKey(user.id), PRESENCE_TTL_SECONDS)
    .exec()

  recordRealtimeMetric('presence.offline', { userId: user.id, workspaceId: user.companyId })
  return true
}

export async function setTypingIndicator(input: { workspaceId: string; channelId: string; user: PresenceUser; typing: boolean }) {
  const redis = getRealtimeRedis()
  if (!redis) return

  if (!input.typing) {
    await redis.del(typingKey(input.workspaceId, input.channelId, input.user.id))
    return
  }

  await redis.set(
    typingKey(input.workspaceId, input.channelId, input.user.id),
    JSON.stringify({
      userId: input.user.id,
      name: input.user.name ?? null,
      role: input.user.role ?? null,
      channelId: input.channelId,
      at: new Date().toISOString(),
    }),
    'EX',
    Math.max(Number(process.env.REALTIME_TYPING_TTL_SECONDS ?? 8), 3)
  )
}

export async function getPresenceSnapshot(workspaceId: string | null | undefined): Promise<PresenceSnapshotEntry[]> {
  if (!workspaceId) return []
  const redis = getRealtimeRedis()
  const now = new Date().toISOString()

  if (!redis) {
    return Array.from(localStore().values())
      .filter((entry) => entry.user.companyId === workspaceId)
      .map((entry) => ({
        userId: entry.user.id,
        name: entry.user.name ?? null,
        role: entry.user.role ?? null,
        companyId: entry.user.companyId ?? null,
        online: true,
        activeChannelId: entry.activeChannelId,
        deviceCount: entry.sockets.size,
        lastSeenAt: entry.lastSeenAt,
        at: now,
      }))
  }

  const userIds = await redis.smembers(workspaceUsersKey(workspaceId))
  if (!userIds.length) return []

  const entries = await Promise.all(
    userIds.map(async (userId) => {
      try {
        const [user, socketIds] = await Promise.all([redis.hgetall(userKey(userId)), redis.smembers(userSocketsKey(userId))])
        if (!user.id) return null
        const live = await hasLiveSockets(redis, userId)
        if (!live) {
          await redis.srem(workspaceUsersKey(workspaceId), userId)
          return null
        }

        return {
          userId: user.id,
          name: deserializeNullable(user.name),
          role: deserializeNullable(user.role),
          companyId: deserializeNullable(user.companyId),
          online: true as boolean,
          activeChannelId: deserializeNullable(user.activeChannelId),
          deviceCount: socketIds.length,
          lastSeenAt: user.lastSeenAt || now,
          at: now,
        } satisfies PresenceSnapshotEntry
      } catch (error) {
        logger.warn('realtime.presence_snapshot_entry_failed', { userId, error: error instanceof Error ? error.message : String(error) })
        return null
      }
    })
  )

  return entries.filter((entry): entry is PresenceSnapshotEntry => Boolean(entry))
}

export async function cleanupStalePresence(workspaceId: string | null | undefined) {
  if (!workspaceId) return
  const redis = getRealtimeRedis()
  if (!redis) return

  await getPresenceSnapshot(workspaceId)
}
