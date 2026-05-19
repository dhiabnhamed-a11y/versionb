'use client'

import { useRealtime, type RealtimeConnectionStatus } from '@/hooks/useRealtime'

type Size = 'sm' | 'md' | 'lg'

type Props = {
  /** Show a text label alongside the dot. */
  showLabel?: boolean
  size?: Size
  className?: string
}

const DOT_SIZE: Record<Size, string> = {
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
}

const TEXT_SIZE: Record<Size, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
}

type StatusConfig = {
  color: string
  pulse: boolean
  label: string
  title: string
}

const STATUS_CONFIG: Record<RealtimeConnectionStatus, StatusConfig> = {
  connected: {
    color: 'bg-emerald-500',
    pulse: false,
    label: 'Live',
    title: 'Realtime connection active',
  },
  reconnecting: {
    color: 'bg-yellow-400',
    pulse: true,
    label: 'Reconnecting…',
    title: 'Realtime connection lost — attempting to reconnect',
  },
  disconnected: {
    color: 'bg-red-500',
    pulse: false,
    label: 'Offline',
    title: 'Realtime connection unavailable',
  },
}

/**
 * Displays the current Socket.IO connection status as a coloured dot.
 * - Green  (solid)   → connected and live
 * - Yellow (pulsing) → reconnecting with exponential backoff
 * - Red    (solid)   → disconnected / offline
 */
export function ConnectionStatus({ showLabel = false, size = 'md', className = '' }: Props) {
  const { status } = useRealtime()
  const config = STATUS_CONFIG[status]
  const dotSize = DOT_SIZE[size]
  const textSize = TEXT_SIZE[size]

  return (
    <span
      role="status"
      aria-label={config.title}
      title={config.title}
      className={`inline-flex items-center gap-1.5 ${className}`}
    >
      <span className={`relative flex ${dotSize}`}>
        {config.pulse && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.color} opacity-75`}
          />
        )}
        <span className={`relative inline-flex rounded-full ${dotSize} ${config.color}`} />
      </span>
      {showLabel && (
        <span className={`${textSize} font-medium text-muted-foreground leading-none`}>
          {config.label}
        </span>
      )}
    </span>
  )
}
