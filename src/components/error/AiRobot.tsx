'use client'

import { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'

export type ConnectionState = 'online' | 'reconnecting' | 'critical' | 'offline'

interface AiRobotProps {
  state: ConnectionState
  onStateChange?: (state: ConnectionState) => void
}

const STATE_COLORS: Record<ConnectionState, { primary: string; glow: string; accent: string }> = {
  online:      { primary: '#22d3ee', glow: 'rgba(34,211,238,0.3)', accent: '#06b6d4' },
  reconnecting:{ primary: '#f59e0b', glow: 'rgba(245,158,11,0.3)', accent: '#d97706' },
  critical:    { primary: '#f43f5e', glow: 'rgba(244,63,94,0.3)', accent: '#e11d48' },
  offline:     { primary: '#64748b', glow: 'rgba(100,116,139,0.2)', accent: '#475569' },
}

function Eye({ color, state, side }: { color: string; state: ConnectionState; side: 'left' | 'right' }) {
  const isOffline = state === 'offline'
  return (
    <motion.g
      animate={{
        scaleY: state === 'critical' ? 0.85 : 1,
      }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      <motion.ellipse
        cx={side === 'left' ? -28 : 28} cy={0}
        rx={16} ry={isOffline ? 10 : 14}
        fill="none"
        stroke={color}
        strokeWidth={isOffline ? 1 : 1.5}
        opacity={isOffline ? 0.3 : 1}
        animate={{
          rx: [16, isOffline ? 10 : 14, 16],
          ry: [14, isOffline ? 10 : 14, 14],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.ellipse
        cx={side === 'left' ? -28 : 28} cy={0}
        rx={8} ry={8}
        fill={color}
        opacity={isOffline ? 0.15 : 0.6}
        animate={{
          opacity: [0.6, 0.8, 0.6],
          scale: [1, 1.05, 1],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.circle
        cx={side === 'left' ? -28 : 28} cy={0}
        r={3}
        fill="#fff"
        opacity={isOffline ? 0.1 : 0.9}
        animate={{
          opacity: [0.9, 0.5, 0.9],
        }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
    </motion.g>
  )
}

function HaloRing({ color, state }: { color: string; state: ConnectionState }) {
  return (
    <motion.g
      animate={{ rotate: 360 }}
      transition={{ duration: state === 'reconnecting' ? 3 : 8, repeat: Infinity, ease: 'linear' }}
      style={{ originX: '50%', originY: '50%' }}
    >
      <ellipse cx={0} cy={0} rx={70} ry={18} fill="none" stroke={color} strokeWidth={0.5} opacity={0.3} />
    </motion.g>
  )
}

function ScanLine({ color, state }: { color: string; state: ConnectionState }) {
  const isReconnecting = state === 'reconnecting'
  return (
    <motion.g>
      <motion.rect
        x={-44} y={-44} width={88} height={88}
        fill="none"
        stroke={color}
        strokeWidth={0.5}
        opacity={0.15}
        rx={4}
      />
      <motion.line
        x1={-44} y1={-44} x2={44} y2={-44}
        stroke={color}
        strokeWidth={1.5}
        opacity={0.6}
        animate={{
          y: isReconnecting ? [0, 88, 0] : [0, 88, 0],
        }}
        transition={{
          duration: isReconnecting ? 1.5 : 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </motion.g>
  )
}

export default function AiRobot({ state }: AiRobotProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [blink, setBlink] = useState(false)
  const colors = STATE_COLORS[state]

  useEffect(() => {
    const interval = setInterval(() => {
      setBlink(true)
      setTimeout(() => setBlink(false), 150)
    }, 3000 + Math.random() * 2000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const onMouse = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      setMousePos({
        x: (e.clientX - cx) / rect.width,
        y: (e.clientY - cy) / rect.height,
      })
    }
    window.addEventListener('mousemove', onMouse)
    return () => window.removeEventListener('mousemove', onMouse)
  }, [])

  const headRotateX = mousePos.y * -6
  const headRotateY = mousePos.x * 6

  return (
    <div ref={containerRef} className="relative w-full h-full flex items-center justify-center">
      <motion.div
        className="relative"
        animate={{
          y: [0, -6, 0],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          perspective: 800,
        }}
      >
        <motion.div
          animate={{
            rotateX: headRotateX,
            rotateY: headRotateY,
          }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <svg
            viewBox="-80 -80 160 160"
            className="w-48 h-48 md:w-64 md:h-64 lg:w-80 lg:h-80"
            style={{ filter: `drop-shadow(0 0 40px ${colors.glow})` }}
          >
            <defs>
              <radialGradient id={`headGrad-${state}`} cx="50%" cy="40%" r="60%">
                <stop offset="0%" stopColor={colors.primary} stopOpacity={0.08} />
                <stop offset="100%" stopColor={colors.primary} stopOpacity={0.02} />
              </radialGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <polygon
              points="0,-60 52,-30 52,30 0,60 -52,30 -52,-30"
              fill={`url(#headGrad-${state})`}
              stroke={colors.primary}
              strokeWidth={1.5}
              opacity={0.8}
            />

            <polygon
              points="0,-55 48,-27 48,27 0,55 -48,27 -48,-27"
              fill="none"
              stroke={colors.primary}
              strokeWidth={0.3}
              opacity={0.2}
            />

            <HaloRing color={colors.primary} state={state} />
            <ScanLine color={colors.primary} state={state} />

            <motion.g
              animate={{ y: blink ? 2 : 0 }}
              transition={{ duration: 0.1 }}
            >
              <Eye color={colors.primary} state={state} side="left" />
              <Eye color={colors.primary} state={state} side="right" />
            </motion.g>

            <motion.path
              d="M-12,24 Q0,30 12,24"
              fill="none"
              stroke={colors.primary}
              strokeWidth={1}
              opacity={state === 'online' ? 0.4 : 0.15}
              animate={{
                opacity: state === 'online' ? [0.4, 0.6, 0.4] : 0.15,
                d: state === 'online'
                  ? ['M-12,24 Q0,30 12,24', 'M-12,26 Q0,32 12,26', 'M-12,24 Q0,30 12,24']
                  : ['M-12,24 Q0,30 12,24'],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />

            {state !== 'offline' && (
              <motion.g
                initial={{ opacity: 0.6 }}
                animate={{ opacity: [0.6, 0.3, 0.6] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                {[-40, -20, 0, 20, 40].map((x, i) => (
                  <circle key={i} cx={x} cy={52} r={1} fill={colors.primary} opacity={0.3 - i * 0.05} />
                ))}
              </motion.g>
            )}

            {state === 'reconnecting' && (
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.6, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <circle cx={0} cy={0} r={50} fill="none" stroke={colors.primary} strokeWidth={0.5} opacity={0.3} />
                <circle cx={0} cy={0} r={50} fill="none" stroke={colors.primary} strokeWidth={2} opacity={0.1}
                  strokeDasharray="4 8"
                />
              </motion.g>
            )}

            {state === 'critical' && (
              <>
                <motion.line
                  x1={-20} y1={-20} x2={20} y2={20}
                  stroke={colors.primary} strokeWidth={1.5} opacity={0.6}
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ duration: 0.3 }}
                />
                <motion.line
                  x1={-20} y1={20} x2={20} y2={-20}
                  stroke={colors.primary} strokeWidth={1.5} opacity={0.6}
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ duration: 0.3, delay: 0.15 }}
                />
              </>
            )}
          </svg>
        </motion.div>

        {state !== 'offline' && (
          <motion.div
            className="absolute -bottom-6 left-1/2 -translate-x-1/2"
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
          >
            <div
              className="w-24 h-0.5 rounded-full"
              style={{
                background: `linear-gradient(90deg, transparent, ${colors.primary}, transparent)`,
                opacity: 0.5,
              }}
            />
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
