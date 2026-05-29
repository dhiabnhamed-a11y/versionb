'use client'

import { motion } from 'framer-motion'
import { useOffline } from '@/lib/offline/OfflineContext'

export default function OfflineBlockingOverlay() {
  const { connectNow, queueLength } = useOffline()

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
        className="relative w-full max-w-md rounded-xl border p-8 shadow-2xl text-center"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'rgba(244,63,94,0.2)',
        }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ background: 'rgba(244,63,94,0.1)' }}
        >
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-3">
          Offline session expired
        </h2>

        <p className="text-sm text-[var(--text-muted)] mb-2 leading-relaxed">
          Your offline session has expired. Connect to the internet to save your work.
        </p>

        {queueLength > 0 && (
          <p className="text-sm font-semibold mb-6" style={{ color: 'var(--danger)' }}>
            {queueLength} change{queueLength === 1 ? '' : 's'} not yet saved.
            If you close this tab without connecting, all offline changes will be permanently lost.
          </p>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={() => connectNow()}
            className="w-full px-6 py-3 rounded-lg text-sm font-semibold text-white transition-all duration-200"
            style={{ background: 'var(--accent)' }}
          >
            Reconnect to save
          </button>

          {queueLength > 0 && (
            <p className="text-xs text-[var(--text-muted)]">
              Your local data will not be deleted until you close this tab or confirm discard.
            </p>
          )}
        </div>
      </motion.div>
    </div>
  )
}
