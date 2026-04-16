/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'

import { useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { getSocket } from '@/lib/socket-client'
import { AlertTriangle, X, CheckCircle2 } from 'lucide-react'

interface AlertData {
  id: string
  type: string
  title: string
  message: string
}

function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const playBeep = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'; osc.frequency.value = freq
      gain.gain.setValueAtTime(0.3, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + dur)
    }
    playBeep(880, 0, 0.15); playBeep(880, 0.2, 0.15)
    playBeep(1100, 0.5, 0.15); playBeep(1100, 0.7, 0.15)
    playBeep(880, 1.0, 0.3)
  } catch (e) {}
}

export default function AlertReceiver({ userId }: { userId: string }) {
  const [alert, setAlert] = useState<AlertData | null>(null)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    let isMounted = true

    void (async () => {
      const socket = await getSocket()
      if (!isMounted || !socket) return

      socketRef.current = socket

      socket.on('connect', () => {
        socket.emit('join', userId)
      })
      socket.on('alert', (data: AlertData) => {
        setAlert(data)
        playAlertSound()
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400])
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`TASKIT: ${data.title}`, { body: data.message, icon: '/icons/taskit-192.png' })
        }
      })

      if (socket.connected) socket.emit('join', userId)
    })()

    return () => {
      isMounted = false
      socketRef.current?.off('alert')
      socketRef.current?.off('connect')
    }
  }, [userId])

  if (!alert) return null

  return (
    <div className="alert-overlay" onClick={e => e.target === e.currentTarget && setAlert(null)}>
      <div className="alert-modal animate-slide-up">
        <button onClick={() => setAlert(null)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <X size={18} />
        </button>

        <div className="alert-icon-ring animate-pulse-glow" style={{ boxShadow: '0 0 0 0 rgba(239,68,68,0.3)' }}>
          <AlertTriangle size={28} />
        </div>

        <h2 className="font-display text-xl font-semibold tracking-tight" style={{ marginBottom: '8px' }}>
          {alert.title}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>{alert.message}</p>

        <button onClick={() => setAlert(null)} className="btn-primary" style={{ width: '100%', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px' }}>
          <CheckCircle2 size={16} /> Acknowledge
        </button>
      </div>
    </div>
  )
}
