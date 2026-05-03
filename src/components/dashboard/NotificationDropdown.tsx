'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, CheckCheck } from 'lucide-react'
import { formatTimeAgo } from '@/lib/utils'

type AlertRecord = {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  createdAt: string
  sender?: { id: string; name: string; avatar?: string | null }
}

export default function NotificationDropdown({ alertsHref = '/dashboard/employee/alerts' }: { alertsHref?: string }) {
  const [alerts, setAlerts] = useState<AlertRecord[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  async function loadAlerts() {
    setLoading(true)
    const body = await fetch('/api/alerts').then((response) => response.json())
    setAlerts(Array.isArray(body) ? body : [])
    setLoading(false)
  }

  useEffect(() => {
    void loadAlerts()
  }, [])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const unreadCount = useMemo(() => alerts.filter((alert) => !alert.read).length, [alerts])

  async function markRead(alertId: string) {
    setAlerts((current) => current.map((alert) => (alert.id === alertId ? { ...alert, read: true } : alert)))
    await fetch('/api/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertId }),
    })
  }

  async function markAllRead() {
    const unread = alerts.filter((alert) => !alert.read)
    setAlerts((current) => current.map((alert) => ({ ...alert, read: true })))
    await Promise.allSettled(
      unread.map((alert) =>
        fetch('/api/alerts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ alertId: alert.id }),
        })
      )
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Open notifications"
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border transition hover:border-[var(--accent)] hover:bg-[var(--accent-subtle)]"
        style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.76)', color: 'var(--text-muted)' }}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white shadow">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-[min(92vw,380px)] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-white shadow-[var(--shadow-float)]">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3">
            <div>
              <div className="text-sm font-black text-[var(--text-primary)]">Notifications</div>
              <div className="text-xs font-semibold text-[var(--text-muted)]">{unreadCount} unread alerts</div>
            </div>
            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold text-[var(--accent)] transition hover:bg-[var(--accent-subtle)] disabled:opacity-40"
            >
              <CheckCheck size={13} />
              Read all
            </button>
          </div>

          <div className="max-h-[360px] overflow-y-auto p-2">
            {loading ? (
              <div className="grid gap-2 p-2">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="loading-shimmer h-16 rounded-[var(--radius-sm)]" />
                ))}
              </div>
            ) : alerts.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm font-semibold text-[var(--text-muted)]">No notifications yet</div>
            ) : (
              alerts.slice(0, 8).map((alert) => (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => markRead(alert.id)}
                  className="w-full rounded-[var(--radius-sm)] p-3 text-left transition hover:bg-[var(--accent-subtle)]"
                  style={{ background: alert.read ? 'transparent' : 'rgba(3,105,161,0.055)' }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-1 h-2.5 w-2.5 rounded-full"
                      style={{ background: alert.read ? 'var(--border-light)' : 'var(--accent)' }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-black text-[var(--text-primary)]">{alert.title}</div>
                      <div className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{alert.message}</div>
                      <div className="mt-2 text-[11px] font-semibold text-[var(--text-light)]">
                        {alert.sender?.name ? `${alert.sender.name} - ` : ''}
                        {formatTimeAgo(alert.createdAt)}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          <Link
            href={alertsHref}
            className="block border-t border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-center text-xs font-black text-[var(--accent)]"
            onClick={() => setOpen(false)}
          >
            Open alert center
          </Link>
        </div>
      )}
    </div>
  )
}
