'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ConnectionState } from './AiRobot'

interface DiagnosticsPanelProps {
  state: ConnectionState
}

function useDiagnostics(state: ConnectionState) {
  const [diag, setDiag] = useState({
    uptime: '00:00:00',
    ping: '—',
    packetsLost: 0,
    signalStrength: 0,
    cpuUsage: 0,
    memoryUsage: 0,
    reconnectAttempts: 0,
  })

  const startTime = useRef<number | null>(null)
  const attemptRef = useRef(0)

  useEffect(() => {
    if (startTime.current === null) startTime.current = Date.now()
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime.current!) / 1000)
      const h = String(Math.floor(elapsed / 3600)).padStart(2, '0')
      const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0')
      const s = String(elapsed % 60).padStart(2, '0')

      if (state === 'reconnecting') {
        attemptRef.current++
      }

      setDiag({
        uptime: `${h}:${m}:${s}`,
        ping: state === 'online' ? `${Math.floor(12 + Math.random() * 20)}ms` : '—',
        packetsLost: state === 'critical' ? Math.floor(Math.random() * 30 + 15) : Math.floor(Math.random() * 3),
        signalStrength: state === 'online' ? 85 + Math.floor(Math.random() * 15) : state === 'reconnecting' ? 30 + Math.floor(Math.random() * 30) : state === 'critical' ? Math.floor(Math.random() * 20) : 0,
        cpuUsage: Math.floor(Math.random() * 20 + 10),
        memoryUsage: Math.floor(Math.random() * 15 + 25),
        reconnectAttempts: attemptRef.current,
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [state])

  return diag
}

function StatBar({ label, value, color, progress }: { label: string; value: string | number; color: string; progress?: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-[var(--text-secondary)]/60 font-mono">{label}</span>
        <span className="font-mono" style={{ color }}>{value}</span>
      </div>
      {progress !== undefined && (
        <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: color }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      )}
    </div>
  )
}

export default function DiagnosticsPanel({ state }: DiagnosticsPanelProps) {
  const diag = useDiagnostics(state)
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="w-full max-w-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors text-xs font-mono text-[var(--text-secondary)]/60"
      >
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
          DIAGNOSTICS CONSOLE
        </span>
        <motion.svg
          animate={{ rotate: expanded ? 180 : 0 }}
          className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
        >
          <path d="M6 9l6 6 6-6" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="mt-2 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] space-y-3">
              <StatBar label="UPTIME" value={diag.uptime} color="#22d3ee" />
              <StatBar label="LATENCY" value={diag.ping} color={state === 'reconnecting' ? '#f59e0b' : '#22d3ee'} />
              <StatBar label="SIGNAL STRENGTH" value={`${diag.signalStrength}%`} color={diag.signalStrength > 70 ? '#22d3ee' : diag.signalStrength > 30 ? '#f59e0b' : '#f43f5e'} progress={diag.signalStrength} />
              <StatBar label="PACKET LOSS" value={`${diag.packetsLost}%`} color={diag.packetsLost > 10 ? '#f43f5e' : '#22d3ee'} progress={diag.packetsLost} />
              <StatBar label="CPU" value={`${diag.cpuUsage}%`} color="#22d3ee" progress={diag.cpuUsage} />
              <StatBar label="MEMORY" value={`${diag.memoryUsage}%`} color="#22d3ee" progress={diag.memoryUsage} />
              {state === 'reconnecting' && (
                <StatBar label="RECONNECT ATTEMPTS" value={diag.reconnectAttempts} color="#f59e0b" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
