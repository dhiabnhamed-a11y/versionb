'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import ParticleBackground from './ParticleBackground'
import AiRobot from './AiRobot'
import DiagnosticsPanel from './DiagnosticsPanel'
import RecoveryEngine from './RecoveryEngine'
import type { ConnectionState } from './AiRobot'

interface ErrorLayoutProps {
  title?: string
  subtitle?: string
  code?: string
  children?: React.ReactNode
  showRobot?: boolean
  showDiagnostics?: boolean
  showRecovery?: boolean
}

export default function ErrorLayout({
  title = 'SYSTEM INTERRUPTION',
  subtitle = 'The system encountered an unexpected state.',
  code = 'ERR_500',
  children,
  showRobot = true,
  showDiagnostics = true,
  showRecovery = false,
}: ErrorLayoutProps) {
  const [aiState, setAiState] = useState<ConnectionState>('critical')
  const [showConsole, setShowConsole] = useState(false)

  const handleRetry = useCallback(() => {
    setAiState('reconnecting')
    setTimeout(() => {
      window.location.reload()
    }, 3000)
  }, [])

  const handleRunDiagnostics = useCallback(() => {
    setShowConsole(!showConsole)
  }, [showConsole])

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#07090e]">
      <ParticleBackground />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 50% 40%, rgba(99,102,241,0.03) 0%, transparent 70%),
            radial-gradient(ellipse 60% 40% at 30% 60%, rgba(34,211,238,0.02) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 70% 30%, rgba(99,102,241,0.02) 0%, transparent 60%)
          `,
        }}
      />

      <div
        className="absolute inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="text-center mb-8"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.06] mb-6">
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="font-mono text-[10px] tracking-[0.2em] text-[var(--text-secondary)]/40">
                TASKIT OS v3.0 — EMERGENCY PROTOCOL
              </span>
            </div>
          </motion.div>

          <h1
            className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-4"
            style={{
              background: 'linear-gradient(135deg, #f1f5f9 0%, #6366f1 50%, #22d3ee 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {code}
          </h1>

          <h2 className="text-lg md:text-xl font-semibold text-[var(--text-secondary)]/80 mb-2 tracking-wide">
            {title}
          </h2>

          <p className="text-sm text-[var(--text-secondary)]/50 max-w-md mx-auto">
            {subtitle}
          </p>
        </motion.div>

        {showRobot && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
            className="mb-8 w-48 h-48 md:w-64 md:h-64 lg:w-80 lg:h-80"
          >
            <AiRobot state={aiState} />
          </motion.div>
        )}

        {showRecovery && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="w-full max-w-lg mb-8"
          >
            <RecoveryEngine state={aiState} onStateChange={setAiState} onRetry={handleRetry} />
          </motion.div>
        )}

        {showDiagnostics && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1 }}
            className="mb-8"
          >
            <DiagnosticsPanel state={aiState} />
          </motion.div>
        )}

        {children}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.4 }}
          className="flex gap-3"
        >
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleRetry}
            className="px-6 py-2.5 rounded-lg font-mono text-xs tracking-wider font-semibold transition-colors border border-[var(--accent)]/30 text-[var(--accent)] hover:bg-[var(--accent)]/10"
          >
            ⟳ RETRY CONNECTION
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleRunDiagnostics}
            className="px-6 py-2.5 rounded-lg font-mono text-xs tracking-wider font-semibold transition-colors border border-white/10 text-[var(--text-secondary)]/60 hover:bg-white/5"
          >
            {showConsole ? 'HIDE CONSOLE' : 'RUN DIAGNOSTICS'}
          </motion.button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 2 }}
          className="mt-12 text-[10px] font-mono tracking-[0.3em] text-[var(--text-secondary)]/20"
        >
          TASKIT OS v3.0.1 · RECOVERY INTERFACE
        </motion.div>
      </div>
    </div>
  )
}
