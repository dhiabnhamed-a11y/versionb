'use client'

import { useEffect, useRef } from 'react'
import { getSocket } from '@/lib/socket-client'
import { getSupabaseBrowserClient } from '@/lib/supabaseClient'
import type { RealtimeEventName } from '@/lib/realtime-events'

const EVENT_TABLES: Partial<Record<RealtimeEventName, string[]>> = {
  task_created: ['Task'],
  task_updated: ['Task'],
  task_deleted: ['Task'],
  task_submission_created: ['TaskSubmission'],
  comment_created: ['Comment'],
  comment_updated: ['Comment'],
  project_created: ['Project'],
  project_updated: ['Project'],
  project_deleted: ['Project'],
  project_media_created: ['ProjectMedia'],
  room_created: ['Room'],
  project_category_created: ['ProjectCategory'],
  employee_invited: ['Invite', 'User'],
  alert: ['Alert'],
  alert_read: ['Alert'],
}

type RealtimeSubscriptionOptions =
  | number
  | {
      debounceMs?: number
      pollingIntervalMs?: number | false
    }

export function useRealtimeSubscription(
  events: readonly RealtimeEventName[],
  onEvent: (eventName: RealtimeEventName, payload: unknown) => void,
  options: RealtimeSubscriptionOptions = 250
) {
  const debounceMs = typeof options === 'number' ? options : options.debounceMs ?? 250
  const pollingIntervalMs = typeof options === 'number' ? false : options.pollingIntervalMs ?? false
  const onEventRef = useRef(onEvent)
  const timerRef = useRef<number | null>(null)
  const pendingRef = useRef<{ eventName: RealtimeEventName; payload: unknown } | null>(null)
  const eventsKey = events.join('|')
  const channelKey = eventsKey.replace(/[^a-zA-Z0-9_-]/g, '-')

  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    let active = true
    const eventList = eventsKey.split('|').filter(Boolean) as RealtimeEventName[]
    let cleanupSocketHandlers: (() => void) | null = null
    let cleanupSupabase: (() => void) | null = null
    let pollingTimer: number | null = null
    let socketLive = false
    let supabaseLive = false

    const emitDebounced = (eventName: RealtimeEventName, payload: unknown) => {
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

    const stopPolling = () => {
      if (pollingTimer) {
        window.clearInterval(pollingTimer)
        pollingTimer = null
      }
    }

    const startPolling = () => {
      if (pollingIntervalMs === false) return
      if (pollingTimer || !active) return
      pollingTimer = window.setInterval(() => {
        emitDebounced('workspace_event', { source: 'polling', at: new Date().toISOString() })
      }, pollingIntervalMs)
    }

    const reconcilePolling = () => {
      if (socketLive || supabaseLive) stopPolling()
      else startPolling()
    }

    void (async () => {
      const socket = await getSocket()
      if (!active) return

      if (!socket) {
        socketLive = false
        reconcilePolling()
        return
      }

      const handlers = eventList.map((eventName) => {
        const eventHandler = (payload: unknown) => emitDebounced(eventName, payload)
        socket.on(eventName, eventHandler)
        return { eventName, eventHandler }
      })
      const handleConnect = () => {
        socketLive = true
        reconcilePolling()
      }
      const handleDisconnect = () => {
        socketLive = false
        reconcilePolling()
      }
      socket.on('connect', handleConnect)
      socket.on('disconnect', handleDisconnect)

      socketLive = socket.connected
      reconcilePolling()

      cleanupSocketHandlers = () => {
        handlers.forEach(({ eventName, eventHandler }) => socket.off(eventName, eventHandler))
        socket.off('connect', handleConnect)
        socket.off('disconnect', handleDisconnect)
      }
    })()

    const supabase = getSupabaseBrowserClient()
    if (supabase) {
      const watchedTables = new Set<string>()
      for (const eventName of eventList) {
        for (const tableName of EVENT_TABLES[eventName] ?? []) watchedTables.add(tableName)
      }

      if (watchedTables.size > 0) {
        const channel = supabase.channel(`workspace-changes-${channelKey || 'all'}`)
        for (const tableName of watchedTables) {
          channel.on(
            'postgres_changes',
            { event: '*', schema: 'public', table: tableName },
            (payload) => {
              emitDebounced('workspace_event', {
                source: 'supabase',
                table: tableName,
                eventType: payload.eventType,
                at: new Date().toISOString(),
              })
            }
          )
        }

        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') supabaseLive = true
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') supabaseLive = false
          reconcilePolling()
        })

        cleanupSupabase = () => {
          void supabase.removeChannel(channel)
        }
      }
    }

    reconcilePolling()

    return () => {
      active = false
      cleanupSocketHandlers?.()
      cleanupSupabase?.()
      stopPolling()
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      pendingRef.current = null
    }
  }, [channelKey, debounceMs, eventsKey, pollingIntervalMs])
}
