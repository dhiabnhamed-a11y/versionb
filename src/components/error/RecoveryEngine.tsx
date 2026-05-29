'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ConnectionState } from './AiRobot'

interface RecoveryEngineProps {
  state: ConnectionState
  onStateChange: (state: ConnectionState) => void
  onRetry: () => void
}

const LOG_LINES: Record<ConnectionState, string[]> = {
  online: [
    '[SYS] All systems nominal.',
    '[NET] Connection stable. Latency within threshold.',
    '[AI] Diagnostic engine idle. Monitoring active.',
    '[SEC] Security protocols verified.',
    '[DB] Database connections healthy.',
    '[CACHE] Edge cache synchronized.',
  ],
  reconnecting: [
    '[SYS] NETWORK INTERRUPTION DETECTED.',
    '[AI] Recovery engine activated.',
    '[NET] Attempting handshake...',
    '[DNS] Resolving endpoint...',
    '[NET] Connection attempt 1/∞ — timeout',
    '[NET] Retrying with exponential backoff...',
    '[AI] Scanning available interfaces...',
    '[NET] Interface found. Negotiating...',
    '[NET] Handshake in progress...',
  ],
  critical: [
    '[SYS] CRITICAL SYSTEM FAILURE.',
    '[AI] Running emergency diagnostics...',
    '[ERR] Unhandled exception in application layer.',
    '[DBG] Stack trace captured.',
    '[AI] Isolating fault domain...',
    '[SYS] Fault isolated to render boundary.',
    '[AI] Attempting recovery procedure Alpha-7...',
  ],
  offline: [
    '[SYS] System in low-power mode.',
    '[NET] No network interface available.',
    '[AI] Standby mode active.',
    '[SYS] Waiting for network signal...',
  ],
}

function useConsoleOutput(state: ConnectionState): string[] {
  const indexRef = useRef(0)
  const [count, setCount] = useState(0)
  const log = LOG_LINES[state] || []

  useEffect(() => {
    indexRef.current = 0

    if (log.length === 0) return
    const interval = setInterval(() => {
      if (indexRef.current < log.length) {
        indexRef.current++
        setCount(indexRef.current)
      }
    }, state === 'reconnecting' ? 1200 : state === 'critical' ? 800 : 2000)

    return () => clearInterval(interval)
  }, [state, log.length])

  return log.slice(0, count + 1)
}

function TypewriterInner({ text, speed }: { text: string; speed: number }) {
  const [displayed, setDisplayed] = useState('')

  useEffect(() => {
    if (!text) return

    let index = 0
    const interval = setInterval(() => {
      index++
      setDisplayed(text.slice(0, index))
      if (index >= text.length) clearInterval(interval)
    }, speed)

    return () => clearInterval(interval)
  }, [text, speed])

  return (
    <span>
      {displayed}
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.5, repeat: Infinity }}
        className="inline-block w-2 h-4 ml-0.5 bg-current align-middle"
        style={{ backgroundColor: 'currentColor' }}
      />
    </span>
  )
}

function TypewriterText({ text, speed = 30 }: { text: string; speed?: number }) {
  return <TypewriterInner key={text} text={text} speed={speed} />
}

export default function RecoveryEngine({ state, onRetry }: RecoveryEngineProps) {
  const logLines = useConsoleOutput(state)
  const [countdown, setCountdown] = useState(10)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current)

    if (state !== 'reconnecting') {
      return
    }

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onRetry()
          return 10
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [state, onRetry])

  const stateLabel = {
    online: 'ALL SYSTEMS NOMINAL',
    reconnecting: 'RECOVERY ENGINE ACTIVE',
    critical: 'CRITICAL FAILURE — RECOVERY PROTOCOL',
    offline: 'NO NETWORK — STANDBY MODE',
  }[state]

  const stateColor = {
    online: '#22d3ee',
    reconnecting: '#f59e0b',
    critical: '#f43f5e',
    offline: '#64748b',
  }[state]

  return (
    <div className="w-full max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
        <motion.div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: stateColor }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [1, 0.7, 1],
          }}
          transition={{ duration: state === 'reconnecting' ? 0.8 : 2, repeat: Infinity }}
        />
        <span
          className="font-mono text-xs tracking-widest font-semibold"
          style={{ color: stateColor }}
        >
          {stateLabel}
        </span>
        {state === 'reconnecting' && (
          <span className="ml-auto font-mono text-xs text-[var(--text-secondary)]/40">
            auto-retry in {countdown}s
          </span>
        )}
      </div>

      <div
        className="px-4 py-3 rounded-lg bg-black/40 border border-white/[0.06] font-mono text-xs leading-relaxed min-h-[180px] max-h-[240px] overflow-y-auto"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
      >
        <AnimatePresence mode="popLayout">
          {logLines.map((line, i) => (
            <motion.div
              key={`${line}-${i}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="py-0.5"
            >
              {i === logLines.length - 1 ? (
                <span style={{ color: stateColor }}>
                  <TypewriterText text={line} speed={15} />
                </span>
              ) : (
                <span className="text-[var(--text-secondary)]/50">{line}</span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex gap-3 justify-center">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onRetry}
          className="px-6 py-2.5 rounded-lg font-mono text-xs tracking-wider font-semibold transition-colors border"
          style={{
            color: stateColor,
            borderColor: `${stateColor}40`,
            background: `${stateColor}08`,
          }}
        >
          ⟳ RETRY CONNECTION
        </motion.button>
      </div>
    </div>
  )
}
