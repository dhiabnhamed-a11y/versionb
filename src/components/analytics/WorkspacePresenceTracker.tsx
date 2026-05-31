'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

const HEARTBEAT_INTERVAL_MS = 60_000

async function postPresence(event?: 'workspace_open') {
  try {
    await fetch('/api/analytics/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        path: window.location.pathname,
      }),
      cache: 'no-store',
      keepalive: true,
    })
  } catch {
    // Presence is best-effort and must never interrupt dashboard use.
  }
}

export default function WorkspacePresenceTracker({ disabled = false }: { disabled?: boolean }) {
  const pathname = usePathname()
  const openedRef = useRef(false)

  useEffect(() => {
    if (disabled || openedRef.current) return

    openedRef.current = true
    void postPresence('workspace_open')

    const interval = window.setInterval(() => {
      void postPresence()
    }, HEARTBEAT_INTERVAL_MS)

    return () => window.clearInterval(interval)
  }, [disabled])

  useEffect(() => {
    if (disabled || !openedRef.current) return
    void postPresence()
  }, [disabled, pathname])

  return null
}
