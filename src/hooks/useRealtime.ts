'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getSocket } from '@/lib/socket-client'

export type RealtimeConnectionStatus = 'connected' | 'reconnecting' | 'disconnected'

export type OutgoingEvent = {
  event: string
  payload: unknown
  queuedAt: number
}

export type RealtimeHook = {
  /** Live connection status of the Socket.IO transport. */
  status: RealtimeConnectionStatus
  isConnected: boolean
  isReconnecting: boolean
  isOffline: boolean
  /**
   * Emit an event to the server. If the socket is offline the event is
   * buffered and flushed automatically when the connection is restored.
   */
  emit: (event: string, payload?: unknown) => void
  /**
   * Register a typed handler for a server-emitted event.
   * Returns a cleanup function that removes the listener.
   */
  on: (event: string, handler: (payload: unknown) => void) => () => void
  /** Number of outgoing events buffered while offline. */
  offlineQueueSize: number
  /**
   * Call this with the expected post-mutation data to optimistically update
   * UI before server confirmation arrives. Pairs with the returned rollback fn.
   */
  optimistic: <T>(apply: () => T, rollback: (snapshot: T) => void) => () => void
}

const MAX_OFFLINE_QUEUE = 100

/**
 * Core realtime hook. Manages Socket.IO connection state, offline outgoing
 * event buffering, and optimistic update helpers.
 *
 * @example
 * const { status, emit, on } = useRealtime()
 */
export function useRealtime(): RealtimeHook {
  const [status, setStatus] = useState<RealtimeConnectionStatus>('disconnected')
  const [offlineQueueSize, setOfflineQueueSize] = useState(0)

  const offlineQueue = useRef<OutgoingEvent[]>([])
  const socketRef = useRef<Awaited<ReturnType<typeof getSocket>> | null>(null)
  const listenersRef = useRef<Map<string, Set<(payload: unknown) => void>>>(new Map())
  const mountedRef = useRef(true)

  const flushOfflineQueue = useCallback((socket: NonNullable<Awaited<ReturnType<typeof getSocket>>>) => {
    const queued = offlineQueue.current.splice(0, offlineQueue.current.length)
    if (queued.length === 0) return
    for (const item of queued) {
      socket.emit(item.event, item.payload)
    }
    if (mountedRef.current) setOfflineQueueSize(0)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    let cleanup: (() => void) | null = null

    void (async () => {
      const socket = await getSocket()
      if (!mountedRef.current) return

      socketRef.current = socket

      if (!socket) {
        if (mountedRef.current) setStatus('disconnected')
        return
      }

      const handleConnect = () => {
        if (!mountedRef.current) return
        setStatus('connected')
        flushOfflineQueue(socket)
      }

      const handleDisconnect = () => {
        if (mountedRef.current) setStatus('disconnected')
      }

      const handleReconnectAttempt = () => {
        if (mountedRef.current) setStatus('reconnecting')
      }

      const handleError = () => {
        if (mountedRef.current) setStatus('reconnecting')
      }

      socket.on('connect', handleConnect)
      socket.on('disconnect', handleDisconnect)
      socket.io.on('reconnect_attempt', handleReconnectAttempt)
      socket.io.on('error', handleError)

      if (socket.connected) {
        setStatus('connected')
      } else {
        setStatus('reconnecting')
      }

      cleanup = () => {
        socket.off('connect', handleConnect)
        socket.off('disconnect', handleDisconnect)
        socket.io.off('reconnect_attempt', handleReconnectAttempt)
        socket.io.off('error', handleError)
      }
    })()

    return () => {
      mountedRef.current = false
      cleanup?.()
    }
  }, [flushOfflineQueue])

  const emit = useCallback((event: string, payload?: unknown) => {
    const socket = socketRef.current
    if (socket?.connected) {
      socket.emit(event, payload)
      return
    }
    if (offlineQueue.current.length < MAX_OFFLINE_QUEUE) {
      offlineQueue.current.push({ event, payload, queuedAt: Date.now() })
      setOfflineQueueSize(offlineQueue.current.length)
    }
  }, [])

  const on = useCallback((event: string, handler: (payload: unknown) => void) => {
    const socket = socketRef.current
    if (socket) {
      socket.on(event, handler)
      return () => socket.off(event, handler)
    }

    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set())
    }
    listenersRef.current.get(event)!.add(handler)
    return () => {
      listenersRef.current.get(event)?.delete(handler)
    }
  }, [])

  const optimistic = useCallback(<T>(apply: () => T, rollback: (snapshot: T) => void) => {
    const snapshot = apply()
    return () => rollback(snapshot)
  }, [])

  return {
    status,
    isConnected: status === 'connected',
    isReconnecting: status === 'reconnecting',
    isOffline: status === 'disconnected',
    emit,
    on,
    offlineQueueSize,
    optimistic,
  }
}
