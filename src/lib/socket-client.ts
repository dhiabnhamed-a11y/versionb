// Socket client singleton - only runs on client side
import type { Socket } from 'socket.io-client'

let socket: Socket | null = null
let socketInitPromise: Promise<Socket | null> | null = null
const LAST_REALTIME_EVENT_ID_KEY = 'taskit:lastRealtimeEventId'

function envFlag(value: string | undefined) {
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

function isSocketIoEnabled() {
  if (typeof window === 'undefined') return false

  const configured = envFlag(process.env.NEXT_PUBLIC_SOCKET_IO_ENABLED)
  if (configured !== null) return configured

  const hostname = window.location.hostname
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return true

  // Vercel does not run this repo's custom Socket.IO server.ts entrypoint.
  // Production deployments should use Supabase realtime / polling unless a
  // separate Socket.IO host is explicitly configured.
  return false
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
      socket = io({
        path: '/api/socketio',
        addTrailingSlash: false,
        withCredentials: true,
        transports: ['websocket', 'polling'],
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 5000,
        timeout: 10000,
      })

      socket.on('connect', () => {
        const afterEventId = window.localStorage.getItem(LAST_REALTIME_EVENT_ID_KEY)
        if (afterEventId) socket?.emit('realtime:replay', { afterEventId })
      })

      socket.on('realtime:event', (event: { id?: string }) => {
        if (!event?.id) return
        window.localStorage.setItem(LAST_REALTIME_EVENT_ID_KEY, event.id)
        socket?.emit('realtime:ack', { eventId: event.id })
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
