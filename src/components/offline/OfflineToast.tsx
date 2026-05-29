'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { OfflineToastState } from '@/lib/offline/types'

interface OfflineToastProps {
  toasts: OfflineToastState[]
  onDismiss: (id: string) => void
}

const COLORS: Record<string, { bg: string; border: string; icon: string }> = {
  info: { bg: 'rgba(34,211,238,0.08)', border: 'rgba(34,211,238,0.2)', icon: '#22d3ee' },
  warning: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', icon: '#f59e0b' },
  error: { bg: 'rgba(244,63,94,0.08)', border: 'rgba(244,63,94,0.2)', icon: '#f43f5e' },
  success: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', icon: '#10b981' },
}

export default function OfflineToast({ toasts, onDismiss }: OfflineToastProps) {
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm">
      <AnimatePresence>
        {toasts.map((toast) => {
          const colors = COLORS[toast.type] || COLORS.info
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="rounded-lg p-3 border shadow-lg backdrop-blur-sm"
              style={{ background: colors.bg, borderColor: colors.border }}
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  {toast.type === 'success' ? (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke={colors.icon} strokeWidth="2">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  ) : toast.type === 'warning' ? (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke={colors.icon} strokeWidth="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  ) : toast.type === 'error' ? (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke={colors.icon} strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke={colors.icon} strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text-primary)]">{toast.message}</p>
                  {toast.action && (
                    <button
                      onClick={toast.action.onClick}
                      className="mt-1.5 text-xs font-semibold underline underline-offset-2 transition-opacity hover:opacity-80"
                      style={{ color: colors.icon }}
                    >
                      {toast.action.label}
                    </button>
                  )}
                </div>
                {toast.dismissible && (
                  <button
                    onClick={() => onDismiss(toast.id)}
                    className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
