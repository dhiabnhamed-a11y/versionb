'use client'

import { useMemo, useEffect, useRef } from 'react'
import { useOffline } from '@/lib/offline/OfflineContext'

function formatRemaining(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}h ${m}m left to save your work`
  if (m > 0) return `${m}m ${s}s left to save your work`
  return `${s}s left to save your work`
}

export default function OfflineBanner() {
  const { status, timer, isSyncing, queueLength, connectNow } = useOffline()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const height = el.getBoundingClientRect().height
    document.documentElement.style.setProperty('--offline-banner-h', `${height}px`)
    return () => { document.documentElement.style.removeProperty('--offline-banner-h') }
  })

  const bgColor = useMemo(() => {
    if (isSyncing) return 'bg-[var(--info)]/10 border-[var(--info)]/30'
    if (timer.warningLevel === 'red') return 'bg-[var(--danger)]/10 border-[var(--danger)]/30'
    if (timer.warningLevel === 'amber') return 'bg-[var(--warning)]/10 border-[var(--warning)]/30'
    return 'bg-[var(--info)]/10 border-[var(--info)]/30'
  }, [timer.warningLevel, isSyncing])

  const dotColor = useMemo(() => {
    if (isSyncing) return 'var(--info)'
    if (timer.warningLevel === 'red') return 'var(--danger)'
    if (timer.warningLevel === 'amber') return 'var(--warning)'
    return 'var(--info)'
  }, [timer.warningLevel, isSyncing])

  const urgencyText = useMemo(() => {
    if (isSyncing) return 'Syncing your offline changes...'
    if (timer.warningLevel === 'red') return 'Connect now or your unsaved work will be lost.'
    if (timer.warningLevel === 'amber') return 'Less than 1 hour remaining.'
    return ''
  }, [timer.warningLevel, isSyncing])

  return (
    <div
      ref={ref}
      className={`fixed top-0 left-0 right-0 z-50 border-b ${bgColor} backdrop-blur-sm`}
      style={{ padding: '8px 16px' }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {isSyncing ? (
            <svg className="w-4 h-4 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
              <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                style={{ color: dotColor }}
              />
            </svg>
          ) : (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" style={{ color: dotColor }}
            >
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M16.72 11.06A10.94 10.94 0 0119 12.55" />
              <path d="M5 12.55a10.94 10.94 0 015.17-2.39" />
              <path d="M10.71 5.05A16 16 0 0122.56 9" />
              <path d="M1.42 9a15.91 15.91 0 014.7-2.88" />
              <path d="M8.53 16.11a6 6 0 016.95 0" />
              <line x1="12" y1="20" x2="12.01" y2="20" />
            </svg>
          )}

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium whitespace-nowrap text-[var(--text-primary)]">
              {status === 'manual-offline' ? 'Working offline' : 'No connection'}
            </span>
            <span className="hidden sm:inline text-sm text-[var(--text-secondary)] truncate">
              {formatRemaining(timer.remaining)}
            </span>
            {urgencyText && (
              <span className="hidden md:inline text-xs text-[var(--text-muted)] italic">
                {urgencyText}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {queueLength > 0 && (
            <span className="text-xs text-[var(--text-muted)] font-mono">
              {queueLength} pending
            </span>
          )}

          <button
            onClick={connectNow}
            className="px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200"
            style={{
              backgroundColor: timer.warningLevel === 'red' ? 'var(--danger)' : 'var(--accent)',
              color: '#fff',
            }}
          >
            {isSyncing ? 'Syncing...' : 'Connect'}
          </button>

          {status === 'manual-offline' && (
            <button
              onClick={connectNow}
              className="px-3 py-1.5 text-xs font-medium rounded-md border transition-all duration-200"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              Go online
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
