'use client'

import { motion } from 'framer-motion'
import { useOffline } from '@/lib/offline/OfflineContext'

export default function OfflineWarningModal() {
  const { timer, connectNow, dismissWarningModal } = useOffline()

  const minutesLeft = Math.floor(timer.remaining / 60000)

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => dismissWarningModal(true)}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative w-full max-w-md rounded-xl border p-6 shadow-2xl"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--danger)/0.3',
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(244,63,94,0.1)' }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              {minutesLeft > 0
                ? `About ${minutesLeft} minutes remaining`
                : 'Less than a minute remaining'}
            </h3>
            <p className="text-sm text-[var(--text-muted)]">
              Your offline session is about to expire. Connect now to save your work.
            </p>
          </div>
        </div>

        <div className="mb-4">
          <div
            className="h-2 rounded-full overflow-hidden"
            style={{ background: 'var(--border)' }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'var(--danger)' }}
              initial={{ width: `${(1 - timer.progress) * 100}%` }}
              animate={{ width: `${(1 - timer.progress) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1 text-right font-mono">
            {Math.floor(timer.remaining / 60000)}m {Math.floor((timer.remaining % 60000) / 1000)}s remaining
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => connectNow()}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200"
            style={{ background: 'var(--accent)' }}
          >
            Connect now
          </button>
          <button
            onClick={() => dismissWarningModal(true)}
            className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            Remind me in 30 min
          </button>
        </div>
      </motion.div>
    </div>
  )
}
