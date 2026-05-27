'use client'

import { useEffect, useCallback, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'

type EmsEventCallback = (payload: any) => void

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_IO_URL || ''
const SOCKET_ENABLED = process.env.NEXT_PUBLIC_SOCKET_IO_ENABLED === 'true'

let globalSocket: Socket | null = null

function getSocket(): Socket | null {
  if (!SOCKET_ENABLED || !SOCKET_URL) return null
  if (!globalSocket) {
    globalSocket = io(SOCKET_URL, {
      path: process.env.NEXT_PUBLIC_SOCKET_IO_PATH || '/api/realtime',
      transports: ['websocket', 'polling'],
      autoConnect: false,
    })
  }
  return globalSocket
}

export function useEmsRealtime(
  companyId: string | undefined,
  events: Record<string, EmsEventCallback>,
  deps: any[] = []
) {
  const callbacksRef = useRef(events)
  callbacksRef.current = events

  useEffect(() => {
    if (!companyId || !SOCKET_ENABLED) return
    const socket = getSocket()
    if (!socket) return

    if (!socket.connected) socket.connect()

    socket.emit('subscribe', { workspaceId: companyId })

    const handlers: Array<() => void> = []
    for (const [event, fn] of Object.entries(callbacksRef.current)) {
      socket.on(event, fn)
      handlers.push(() => socket.off(event, fn))
    }

    return () => {
      handlers.forEach((h) => h())
    }
  }, [companyId, SOCKET_ENABLED, ...deps])
}

export function emitEmsClient(event: string, payload: any) {
  const socket = getSocket()
  if (socket?.connected) socket.emit(event, payload)
}
