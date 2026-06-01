import type { Server as HttpServer } from 'http'
import { Server as SocketIOServer, type Socket } from 'socket.io'
import { getToken } from 'next-auth/jwt'
import { getAuthSecret } from '@/lib/env'
import { prisma } from '@/lib/db'
import { canAuthenticateAuthState } from '@/lib/security'
import { emitPresence } from '@/lib/realtime-server'
import { assertRealtimeRedisReadyForProduction, attachRedisAdapter, getRealtimeRedis, isRealtimeRedisRequired } from '@/modules/realtime/adapters/redis'
import { channelRoom, workspaceRoom } from '@/modules/realtime/events/contracts'
import { recordRealtimeMetric } from '@/modules/realtime/metrics/metrics'
import {
  cleanupStalePresence,
  getPresenceSnapshot,
  markActiveChannel,
  markSocketConnected,
  markSocketDisconnected,
  refreshSocketHeartbeat,
  setTypingIndicator,
  type PresenceUser,
} from '@/modules/realtime/presence/presence-store'
import { loadMissedRealtimeEvents, recordSocketRecoveryOffset } from '@/modules/realtime/recovery/recovery'
import { logger } from '@/modules/shared/logger'

type RateLimitBucket = {
  count: number
  resetAt: number
}

type RealtimeSocketData = {
  user: PresenceUser
  instanceId: string
  buckets: Map<string, RateLimitBucket>
}

function makeInstanceId() {
  return process.env.INSTANCE_ID || process.env.HOSTNAME || `taskit-${process.pid}`
}

async function checkSocketRateLimit(socket: Socket, key: string, limit: number, windowMs: number) {
  const data = socket.data as RealtimeSocketData
  const now = Date.now()
  const redis = getRealtimeRedis()

  if (redis) {
    const bucket = Math.floor(now / windowMs)
    const rateKey = `taskit:realtime:rate:${data.user.companyId ?? data.user.id}:${data.user.id}:${key}:${bucket}`
    const count = await redis.incr(rateKey)
    if (count === 1) await redis.pexpire(rateKey, windowMs + 1_000)
    if (count <= limit) return true

    recordRealtimeMetric('socket.rate_limited', {
      socketId: socket.id,
      userId: data.user.id,
      workspaceId: data.user.companyId,
      key,
      distributed: true,
    })
    return false
  }

  const current = data.buckets.get(key)
  if (!current || current.resetAt <= now) {
    data.buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  current.count += 1
  if (current.count <= limit) return true

  recordRealtimeMetric('socket.rate_limited', {
    socketId: socket.id,
    userId: data.user.id,
    workspaceId: data.user.companyId,
    key,
  })
  return false
}

async function authenticateSocket(socket: Socket) {
  const authSecret = getAuthSecret('realtime.socket')
  if (!authSecret) throw new Error('Unauthorized')

  const token = await getToken({
    req: socket.request as Parameters<typeof getToken>[0]['req'],
    secret: authSecret,
  })

  if (!token?.id) throw new Error('Unauthorized')

  const liveUser = await prisma.user.findUnique({
    where: { id: String(token.id) },
    select: {
      id: true,
      name: true,
      role: true,
      accountStatus: true,
      companyId: true,
      company: { select: { status: true } },
    },
  })
  if (!liveUser) throw new Error('Unauthorized')

  const authState = {
    id: liveUser.id,
    role: liveUser.role,
    accountStatus: liveUser.accountStatus,
    companyStatus: liveUser.company?.status ?? null,
    email: typeof token.email === 'string' ? token.email : null,
  }
  if (!canAuthenticateAuthState(authState)) throw new Error('Unauthorized')

  return {
    id: liveUser.id,
    name: liveUser.name,
    role: liveUser.role,
    companyId: liveUser.companyId,
  } satisfies PresenceUser
}

export async function createSocketServer(httpServer: HttpServer) {
  const instanceId = makeInstanceId()
  const io = new SocketIOServer(httpServer, {
    path: process.env.SOCKET_IO_PATH || '/api/socketio',
    addTrailingSlash: false,
    transports: ['websocket'],
    perMessageDeflate: false,
    httpCompression: false,
    cors: {
      origin: process.env.APP_URL || false,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    connectionStateRecovery: {
      maxDisconnectionDuration: Math.max(Number(process.env.SOCKET_IO_RECOVERY_MS ?? 120_000), 10_000),
      skipMiddlewares: false,
    },
    pingInterval: Math.max(Number(process.env.SOCKET_IO_PING_INTERVAL_MS ?? 25_000), 5_000),
    pingTimeout: Math.max(Number(process.env.SOCKET_IO_PING_TIMEOUT_MS ?? 20_000), 5_000),
    maxHttpBufferSize: Math.max(Number(process.env.SOCKET_IO_MAX_HTTP_BUFFER_BYTES ?? 1_000_000), 64_000),
  })

  await assertRealtimeRedisReadyForProduction()
  const redisAdapterAttached = await attachRedisAdapter(io)
  if (isRealtimeRedisRequired() && !redisAdapterAttached) {
    throw new Error('Socket.IO Redis adapter is required in production.')
  }
  global.io = io

  const MAX_CONNECTIONS = Number(process.env.SOCKET_IO_MAX_CONNECTIONS ?? 10_000)

  io.use(async (socket, nextHandler) => {
    const currentCount = io.engine.clientsCount
    if (currentCount >= MAX_CONNECTIONS) {
      recordRealtimeMetric('socket.connection_rejected_limit')
      return nextHandler(new Error('Server at capacity. Try again shortly.'))
    }

    try {
      const user = await authenticateSocket(socket)
      socket.data = {
        ...socket.data,
        user,
        instanceId,
        buckets: new Map<string, RateLimitBucket>(),
      } satisfies RealtimeSocketData
      return nextHandler()
    } catch (error) {
      recordRealtimeMetric('socket.auth_failed')
      logger.error('realtime.socket_auth_failed', error)
      return nextHandler(new Error('Unauthorized'))
    }
  })

  io.on('connection', (socket) => {
    const data = socket.data as RealtimeSocketData
    const user = data.user
    const companyId = user.companyId

    socket.join(`user:${user.id}`)
    if (companyId) socket.join(workspaceRoom(companyId))

    void markSocketConnected(user, socket.id, instanceId)
      .then((wasOffline) => {
        recordRealtimeMetric(socket.recovered ? 'socket.recovered' : 'socket.connected', {
          socketId: socket.id,
          userId: user.id,
          workspaceId: companyId,
          instanceId,
        })

        if (companyId && wasOffline) emitPresence(companyId, 'user_online', user)
      })
      .catch((error) => logger.error('realtime.presence_connect_failed', error, { socketId: socket.id, userId: user.id }))

    void getPresenceSnapshot(companyId)
      .then((snapshot) => socket.emit('presence_snapshot', snapshot))
      .catch((error) => logger.error('realtime.presence_snapshot_failed', error, { socketId: socket.id, userId: user.id }))

    const heartbeat = setInterval(() => {
      void refreshSocketHeartbeat(socket.id).catch((error) =>
        logger.warn('realtime.heartbeat_failed', { socketId: socket.id, error: error instanceof Error ? error.message : String(error) })
      )
    }, Math.max(Number(process.env.REALTIME_HEARTBEAT_REFRESH_MS ?? 30_000), 10_000))

    socket.on('join', async (userId: string) => {
      if (userId === user.id && (await checkSocketRateLimit(socket, 'join:user', 20, 10_000))) {
        socket.join(`user:${user.id}`)
      }
    })

    const subscribeToWorkspace = async (workspaceId: string) => {
      if (!(await checkSocketRateLimit(socket, 'workspace:subscribe', 30, 10_000))) return
      if (!workspaceId || workspaceId !== companyId) {
        socket.emit('realtime:error', { code: 'FORBIDDEN', message: 'Unauthorized workspace subscription.' })
        return
      }
      await socket.join(workspaceRoom(workspaceId))
      await cleanupStalePresence(workspaceId)
      recordRealtimeMetric('room.joined', { socketId: socket.id, userId: user.id, workspaceId, room: 'workspace' })
      socket.emit('presence_snapshot', await getPresenceSnapshot(workspaceId))
    }

    socket.on('workspace:subscribe', subscribeToWorkspace)

    socket.on('subscribe', async (payload: { workspaceId?: string } | string) => {
      const workspaceId = typeof payload === 'string' ? payload : payload?.workspaceId
      await subscribeToWorkspace(workspaceId ?? '')
    })

    socket.on('channel:subscribe', async (channelId: string) => {
      if (!companyId || !channelId || !(await checkSocketRateLimit(socket, 'channel:subscribe', 60, 10_000))) return
      const normalizedChannelId = String(channelId).slice(0, 128)
      await socket.join(channelRoom(companyId, normalizedChannelId))
      await markActiveChannel(socket.id, normalizedChannelId)
      recordRealtimeMetric('room.joined', { socketId: socket.id, userId: user.id, workspaceId: companyId, room: 'channel' })
    })

    socket.on('channel:unsubscribe', async (channelId: string) => {
      if (!companyId || !channelId) return
      const normalizedChannelId = String(channelId).slice(0, 128)
      await socket.leave(channelRoom(companyId, normalizedChannelId))
      await markActiveChannel(socket.id, null)
    })

    socket.on('typing:start', async (payload: { channelId?: string }) => {
      if (!companyId || !payload?.channelId || !(await checkSocketRateLimit(socket, 'typing', 80, 10_000))) return
      const channelId = String(payload.channelId).slice(0, 128)
      await setTypingIndicator({ workspaceId: companyId, channelId, user, typing: true })
      socket.to(channelRoom(companyId, channelId)).emit('typing:start', { userId: user.id, name: user.name ?? null, channelId })
    })

    socket.on('typing:stop', async (payload: { channelId?: string }) => {
      if (!companyId || !payload?.channelId) return
      const channelId = String(payload.channelId).slice(0, 128)
      await setTypingIndicator({ workspaceId: companyId, channelId, user, typing: false })
      socket.to(channelRoom(companyId, channelId)).emit('typing:stop', { userId: user.id, channelId })
    })

    socket.on('realtime:ack', (payload: { eventId?: string }) => {
      if (payload?.eventId) void recordSocketRecoveryOffset(user.id, String(payload.eventId), companyId)
    })

    socket.on('realtime:replay', async (payload: { afterEventId?: string | null }) => {
      if (!companyId || !(await checkSocketRateLimit(socket, 'realtime:replay', 10, 60_000))) return
      recordRealtimeMetric('event.replay_requested', { socketId: socket.id, userId: user.id, workspaceId: companyId })
      const missed = await loadMissedRealtimeEvents({ workspaceId: companyId, afterEventId: payload?.afterEventId ?? null, userId: user.id })
      socket.emit('realtime:replay', missed)
    })

    socket.on('disconnect', (reason) => {
      clearInterval(heartbeat)
      void markActiveChannel(socket.id, null).catch((error) =>
        logger.warn('realtime.room_cleanup_failed', { socketId: socket.id, error: error instanceof Error ? error.message : String(error) })
      )
      recordRealtimeMetric('socket.disconnected', {
        socketId: socket.id,
        userId: user.id,
        workspaceId: companyId,
        reason,
        instanceId,
      })

      void markSocketDisconnected(user, socket.id)
        .then((isOffline) => {
          if (companyId && isOffline) emitPresence(companyId, 'user_offline', user)
        })
        .catch((error) => logger.error('realtime.presence_disconnect_failed', error, { socketId: socket.id, userId: user.id }))
    })
  })

  logger.info('realtime.socket_server_ready', { instanceId })
  return io
}
