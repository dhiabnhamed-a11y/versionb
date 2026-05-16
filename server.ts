// Custom Next.js server with distributed Socket.IO attached.
import { createServer } from 'http'
import next from 'next'
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

const app = next({ dev, httpServer, hostname, port, webpack: dev })
handleRef.current = app.getRequestHandler()

app.prepare().then(async () => {
  await createSocketServer(httpServer)

  httpServer.listen(port, () => {
    logger.info('server.ready', { url: `http://${hostname}:${port}` })
  })
})
