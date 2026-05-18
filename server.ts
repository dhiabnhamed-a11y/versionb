// Custom Next.js server with distributed Socket.IO attached.
import { createServer } from 'http'
import next from 'next'
import { disconnectDatabase } from './src/lib/db'
import { createSocketServer } from './src/modules/realtime/socket/socket-server'
import { logger } from './src/modules/shared/logger'

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || 'localhost'
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

httpServer.keepAliveTimeout = 65_000
httpServer.headersTimeout = 66_000

const app = next({ dev, httpServer, hostname, port, webpack: dev })
handleRef.current = app.getRequestHandler()

let shuttingDown = false

async function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  logger.info('server.shutdown', { signal })
  await new Promise<void>((resolve) => httpServer.close(() => resolve()))
  await disconnectDatabase().catch(() => undefined)
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))

app.prepare().then(async () => {
  await createSocketServer(httpServer)

  httpServer.listen(port, () => {
    logger.info('server.ready', { url: `http://${hostname}:${port}` })
  })
})
