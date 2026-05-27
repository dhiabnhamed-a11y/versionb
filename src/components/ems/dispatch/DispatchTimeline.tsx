'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, Radio, Activity, Bell, Navigation, CheckCircle2, Zap, AlertTriangle } from 'lucide-react'
import { useLocale } from '@/components/i18n/LocaleProvider'

type TimelineEvent = {
  id: string
  type: 'received' | 'ai_analysis' | 'unit_assigned' | 'crew_notified' | 'en_route' | 'eta_update' | 'radio' | 'arrived' | 'alert'
  title: string
  description: string
  timestamp: Date
  critical?: boolean
}

export default function DispatchTimeline({
  events,
  etaSeconds,
}: {
  events: TimelineEvent[]
  etaSeconds: number
}) {
  const { t } = useLocale()
  const [etaDisplay, setEtaDisplay] = useState(etaSeconds)

  useEffect(() => {
    setEtaDisplay(etaSeconds)
  }, [etaSeconds])

  useEffect(() => {
    if (etaDisplay <= 0) return
    const interval = setInterval(() => {
      setEtaDisplay((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [etaDisplay])

  const eventIcons: Record<string, React.ReactNode> = {
    received: <AlertTriangle size={12} color="#ef4444" />,
    ai_analysis: <Zap size={12} color="#8b5cf6" />,
    unit_assigned: <CheckCircle2 size={12} color="#3b82f6" />,
    crew_notified: <Bell size={12} color="#f97316" />,
    en_route: <Navigation size={12} color="#22c55e" />,
    eta_update: <Clock size={12} color="#60a5fa" />,
    radio: <Radio size={12} color="#eab308" />,
    arrived: <CheckCircle2 size={12} color="#22c55e" />,
    alert: <AlertTriangle size={12} color="#dc2626" />,
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 10, overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Clock size={13} color="#60a5fa" />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{t('timeline.received')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <motion.span
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{ width: 4, height: 4, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}
          />
          <span style={{ fontSize: 10, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
            ETA {etaDisplay > 0 ? `${Math.floor(etaDisplay / 60)}m ${etaDisplay % 60}s` : t('timeline.arrived')}
          </span>
        </div>
      </div>

      <div style={{ padding: '12px 16px', maxHeight: 280, overflow: 'auto' }}>
        <AnimatePresence initial={false}>
          {events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#475569', fontSize: 11 }}>
              {t('timeline.noEvents')}
            </div>
          ) : (
            [...events].reverse().map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -10, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                style={{
                  display: 'flex', gap: 10, padding: '6px 0',
                  borderBottom: index < events.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: event.critical ? 'rgba(220,38,38,0.15)' : 'rgba(255,255,255,0.04)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `1px solid ${event.critical ? 'rgba(220,38,38,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  }}>
                    {eventIcons[event.type] || <Activity size={10} color="#64748b" />}
                  </div>
                  {index < events.length - 1 && (
                    <div style={{ width: 1, flex: 1, minHeight: 12, background: 'rgba(255,255,255,0.06)' }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0, paddingBottom: index < events.length - 1 ? 0 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: event.critical ? '#fca5a5' : '#cbd5e1' }}>
                      {event.title}
                    </span>
                    <span style={{ fontSize: 9, color: '#475569', flexShrink: 0, marginLeft: 8 }}>
                      {event.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{event.description}</div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
