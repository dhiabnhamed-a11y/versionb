// Custom Next.js server with Socket.io integrated.
import { createServer } from 'http'
import next from 'next'
import { Server as SocketIOServer } from 'socket.io'

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

let handle: ReturnType<ReturnType<typeof next>['getRequestHandler']> | undefined

const httpServer = createServer((req, res) => {
  if (!handle) {
    res.statusCode = 503
    res.end('Server is starting')
    return
  }

  void handle(req, res)
})

const app = next({ dev, httpServer, webpack: dev })
handle = app.getRequestHandler()

// Store the Socket.io instance globally so API routes can access it.
declare global {
  var io: SocketIOServer | undefined
}

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
  console.log('Client connected:', socket.id)

  socket.on('join', (userId: string) => {
    socket.join(`user:${userId}`)
    console.log(`User ${userId} joined their room`)
  })

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)
  })
})

app.prepare().then(() => {
  httpServer.listen(port, () => {
    console.log(`TASKIT server ready at http://${hostname}:${port}`)
  })
})
