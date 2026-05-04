// Custom Next.js server with Socket.io integrated.
import { createServer } from 'http'
import next from 'next'
import { Server as SocketIOServer } from 'socket.io'
import { getToken } from 'next-auth/jwt'
import { emitPresence } from './src/lib/realtime-server'

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

const handleRef: { current?: ReturnType<ReturnType<typeof next>['getRequestHandler']> } = {}

const httpServer = createServer((req, res) => {
  if (!handleRef.current) {
    res.statusCode = 503
    res.end('Server is starting')
    return
  }

  void handleRef.current(req, res)
})

const app = next({ dev, httpServer, webpack: dev })
handleRef.current = app.getRequestHandler()

type RealtimeSocketUser = {
  id: string
  name?: string | null
  role?: string | null
  companyId?: string | null
}

const onlineUsers = new Map<string, { user: RealtimeSocketUser; socketIds: Set<string> }>()

const io = new SocketIOServer(httpServer, {
  path: '/api/socketio',
  addTrailingSlash: false,
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || `http://${hostname}:${port}`,
    credentials: true,
    methods: ['GET', 'POST'],
  },
})

global.io = io

io.use(async (socket, nextHandler) => {
  try {
    const token = await getToken({
      req: socket.request as Parameters<typeof getToken>[0]['req'],
      secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'taskforce-super-secret-key-2024-change-in-production',
    })

    if (!token?.id) {
      return nextHandler(new Error('Unauthorized'))
    }

    socket.data.user = {
      id: String(token.id),
      name: typeof token.name === 'string' ? token.name : null,
      role: typeof token.role === 'string' ? token.role : null,
      companyId: typeof token.companyId === 'string' ? token.companyId : null,
    } satisfies RealtimeSocketUser

    return nextHandler()
  } catch (error) {
    console.error('Socket auth failed:', error)
    return nextHandler(new Error('Unauthorized'))
  }
})

io.on('connection', (socket) => {
  const user = socket.data.user as RealtimeSocketUser
  const companyId = user.companyId

  socket.join(`user:${user.id}`)
  if (companyId) socket.join(`company:${companyId}`)

  const existing = onlineUsers.get(user.id)
  const wasOffline = !existing
  if (existing) {
    existing.socketIds.add(socket.id)
  } else {
    onlineUsers.set(user.id, { user, socketIds: new Set([socket.id]) })
  }

  if (companyId && wasOffline) {
    emitPresence(companyId, 'user_online', user)
  }

  socket.emit(
    'presence_snapshot',
    Array.from(onlineUsers.values())
      .map((entry) => entry.user)
      .filter((entry) => entry.companyId && entry.companyId === companyId)
      .map((entry) => ({
        userId: entry.id,
        name: entry.name ?? null,
        role: entry.role ?? null,
        companyId: entry.companyId ?? null,
        online: true,
        at: new Date().toISOString(),
      }))
  )

  socket.on('join', (userId: string) => {
    if (userId === user.id) {
      socket.join(`user:${user.id}`)
    }
  })

  socket.on('disconnect', () => {
    const current = onlineUsers.get(user.id)
    if (!current) return

    current.socketIds.delete(socket.id)
    if (current.socketIds.size === 0) {
      onlineUsers.delete(user.id)
      if (companyId) {
        emitPresence(companyId, 'user_offline', user)
      }
    }
  })
})

app.prepare().then(() => {
  httpServer.listen(port, () => {
    console.log(`TASKIT server ready at http://${hostname}:${port}`)
  })
})
