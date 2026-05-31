// Socket client singleton - only runs on client side
import type { Socket } from 'socket.io-client'

let socket: Socket | null = null
let socketInitPromise: Promise<Socket | null> | null = null
const LAST_REALTIME_EVENT_ID_KEY = 'taskit:lastRealtimeEventId'

function rememberRealtimeEvent(event: { id?: string } | null | undefined) {
  if (!event?.id) return
  window.localStorage.setItem(LAST_REALTIME_EVENT_ID_KEY, event.id)
  socket?.emit('realtime:ack', { eventId: event.id })
}

function envFlag(value: string | undefined) {
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

function configuredSocketIoUrl() {
  const url = process.env.NEXT_PUBLIC_SOCKET_IO_URL?.trim()
  return url || undefined
}

function isLocalhost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

function isVercelHostname(hostname: string) {
  return hostname === 'vercel.app' || hostname.endsWith('.vercel.app')
}

function isSocketIoEnabled() {
  if (typeof window === 'undefined') return false

  const configured = envFlag(process.env.NEXT_PUBLIC_SOCKET_IO_ENABLED)
  if (configured === false) return false

  const hostname = window.location.hostname
  if (configuredSocketIoUrl()) return configured ?? true
  if (isLocalhost(hostname)) return configured ?? true

  // Vercel does not run this repo's custom Socket.IO server.ts entrypoint.
  // Production deployments should use Supabase realtime / polling unless a
  // separate Socket.IO host is explicitly configured.
  if (isVercelHostname(hostname)) return false

  return configured === true
}

export async function getSocket(): Promise<Socket | null> {
  if (socket) {
    return socket
  }

  if (!isSocketIoEnabled()) {
    return null
  }

  if (!socketInitPromise) {
    socketInitPromise = (async () => {
      const { io } = await import('socket.io-client')
      socket = io(configuredSocketIoUrl(), {
        path: process.env.NEXT_PUBLIC_SOCKET_IO_PATH || '/api/socketio',
        addTrailingSlash: false,
        withCredentials: true,
        transports: ['websocket'],
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 5000,
        timeout: 10000,
      })

      socket.on('connect', () => {
        const afterEventId = window.localStorage.getItem(LAST_REALTIME_EVENT_ID_KEY)
        if (afterEventId) socket?.emit('realtime:replay', { afterEventId })
      })

      socket.on('realtime:event', rememberRealtimeEvent)

      socket.on('realtime:replay', (events: Array<{ id?: string }> | null | undefined) => {
        const last = Array.isArray(events) && events.length ? events[events.length - 1] : null
        rememberRealtimeEvent(last)
      })

      return socket
    })().finally(() => {
      socketInitPromise = null
    })
  }

  return socketInitPromise
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export function isRealtimeAlertsEnabled() {
  return isSocketIoEnabled()
}
