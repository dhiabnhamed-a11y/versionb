// Socket client singleton - only runs on client side
import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null
let socketInitPromise: Promise<Socket | null> | null = null
let socketUnavailable = false

async function hasSocketEndpoint() {
  if (typeof window === 'undefined' || socketUnavailable) {
    return false
  }

  try {
    const response = await fetch(`/api/socketio?EIO=4&transport=polling&t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
    })

    if (response.status === 404) {
      socketUnavailable = true
      return false
    }

    return response.ok
  } catch {
    socketUnavailable = true
    return false
  }
}

export async function getSocket(): Promise<Socket | null> {
  if (socket) {
    return socket
  }

  if (socketUnavailable) {
    return null
  }

  if (!socketInitPromise) {
    socketInitPromise = (async () => {
      const endpointAvailable = await hasSocketEndpoint()
      if (!endpointAvailable) {
        return null
      }

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
