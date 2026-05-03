'use client'

import { useEffect, useRef } from 'react'
import { getSocket } from '@/lib/socket-client'
import type { RealtimeEventName } from '@/lib/realtime-events'

export function useRealtimeSubscription(
  events: readonly RealtimeEventName[],
  onEvent: (eventName: RealtimeEventName, payload: unknown) => void,
  debounceMs = 250
) {
  const onEventRef = useRef(onEvent)
  const timerRef = useRef<number | null>(null)
  const pendingRef = useRef<{ eventName: RealtimeEventName; payload: unknown } | null>(null)

  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    let active = true
    let cleanupSocketHandlers: (() => void) | null = null

    void (async () => {
      const socket = await getSocket()
      if (!active || !socket) return

      const handler = (eventName: RealtimeEventName) => (payload: unknown) => {
        pendingRef.current = { eventName, payload }

        if (timerRef.current) {
          window.clearTimeout(timerRef.current)
        }

        timerRef.current = window.setTimeout(() => {
          const pending = pendingRef.current
          if (pending) {
            onEventRef.current(pending.eventName, pending.payload)
          }
          pendingRef.current = null
          timerRef.current = null
        }, debounceMs)
      }

      const handlers = events.map((eventName) => {
        const eventHandler = handler(eventName)
        socket.on(eventName, eventHandler)
        return { eventName, eventHandler }
      })

      cleanupSocketHandlers = () => {
        handlers.forEach(({ eventName, eventHandler }) => socket.off(eventName, eventHandler))
      }
    })()

    return () => {
      active = false
      cleanupSocketHandlers?.()
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [debounceMs, events])
}
