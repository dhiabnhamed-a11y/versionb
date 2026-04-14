// Custom Next.js server with Socket.io integrated
import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server as SocketIOServer } from 'socket.io'

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// Store socket io instance globally so API routes can access it
declare global {
  // eslint-disable-next-line no-var
  var io: SocketIOServer | undefined
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  })

  const io = new SocketIOServer(httpServer, {
    path: '/api/socketio',
    addTrailingSlash: false,
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  })

  global.io = io

  io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id)

    // Each user joins their own room identified by userId
    socket.on('join', (userId: string) => {
      socket.join(`user:${userId}`)
      console.log(`👤 User ${userId} joined their room`)
    })

    socket.on('disconnect', () => {
      console.log('🔌 Client disconnected:', socket.id)
    })
  })

  httpServer.listen(port, () => {
    console.log(`🚀 TaskForce server ready at http://${hostname}:${port}`)
  })
})
