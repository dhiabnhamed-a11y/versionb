import { io } from 'socket.io-client'

const url = process.env.REALTIME_LOAD_TEST_URL || 'http://localhost:3000'
const path = process.env.SOCKET_IO_PATH || '/api/socketio'
const clients = Math.max(Number(process.env.REALTIME_LOAD_TEST_CLIENTS ?? 1000), 1)
const durationMs = Math.max(Number(process.env.REALTIME_LOAD_TEST_DURATION_MS ?? 60_000), 5_000)
const cookie = process.env.REALTIME_LOAD_TEST_COOKIE || ''

let connected = 0
let disconnected = 0
let errors = 0

const sockets = Array.from({ length: clients }, (_value, index) => {
  const socket = io(url, {
    path,
    addTrailingSlash: false,
    transports: ['websocket'],
    withCredentials: true,
    extraHeaders: cookie ? { cookie } : undefined,
    timeout: 10_000,
    reconnection: true,
    reconnectionAttempts: 3,
    auth: { loadTestClient: index },
  })

  socket.on('connect', () => {
    connected += 1
    socket.emit('workspace:subscribe', process.env.REALTIME_LOAD_TEST_WORKSPACE_ID || '')
  })
  socket.on('disconnect', () => {
    disconnected += 1
  })
  socket.on('connect_error', () => {
    errors += 1
  })
  socket.on('realtime:error', () => {
    errors += 1
  })

  return socket
})

setTimeout(() => {
  for (const socket of sockets) socket.disconnect()
  const result = {
    url,
    clients,
    connected,
    disconnected,
    errors,
    durationMs,
    successRate: Number((connected / clients).toFixed(4)),
  }
  console.log(JSON.stringify(result, null, 2))
  process.exit(errors > clients * 0.05 ? 1 : 0)
}, durationMs)
