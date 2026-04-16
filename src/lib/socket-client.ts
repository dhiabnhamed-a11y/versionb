// Socket client singleton - only runs on client side
import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null
let socketInitPromise: Promise<Socket | null> | null = null
const realtimeEnabled = typeof window !== 'undefined' && process.env.NODE_ENV !== 'production'

export async function getSocket(): Promise<Socket | null> {
  if (socket) {
    return socket
  }

  if (!realtimeEnabled) {
    return null
  }

  if (!socketInitPromise) {
    socketInitPromise = (async () => {
      socket = io({
        path: '/api/socketio',
        addTrailingSlash: false,
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
  return realtimeEnabled
}
