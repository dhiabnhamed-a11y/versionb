import 'dotenv/config'
import { createServer } from 'http'
import { createSocketServer } from './src/modules/realtime/socket/socket-server'
import { logger } from './src/modules/shared/logger'

const hostname = process.env.REALTIME_GATEWAY_HOST || process.env.HOSTNAME || '0.0.0.0'
const port = parseInt(process.env.REALTIME_GATEWAY_PORT || process.env.PORT || '3001', 10)

const httpServer = createServer((req, res) => {
  if (req.url === '/health' || req.url === '/api/realtime/health') {
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ ok: true, service: 'taskit-realtime-gateway', at: new Date().toISOString() }))
    return
  }

  res.statusCode = 404
  res.end('Realtime gateway')
})

void createSocketServer(httpServer).then(() => {
  httpServer.listen(port, hostname, () => {
    logger.info('realtime.gateway_ready', { url: `http://${hostname}:${port}` })
  })
})
