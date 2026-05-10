'use client'

import { useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { getSocket } from '@/lib/socket-client'
import { playTaskitNotificationSound, registerTaskitNotificationSoundUnlock } from '@/lib/notification-sound'
import { AlertTriangle, X, CheckCircle2 } from 'lucide-react'

interface AlertData {
  id: string
  type: string
  title: string
  message: string
}

export default function AlertReceiver({ userId }: { userId: string }) {
  const [alert, setAlert] = useState<AlertData | null>(null)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    registerTaskitNotificationSoundUnlock()

    let isMounted = true
    let cleanupHandlers: (() => void) | null = null

    void (async () => {
      const socket = await getSocket()
      if (!isMounted || !socket) return

      socketRef.current = socket

      const handleConnect = () => {
        socket.emit('join', userId)
      }
      const handleAlert = (data: AlertData) => {
        setAlert(data)
        void playTaskitNotificationSound({ force: true })
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400])
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`TASKIT: ${data.title}`, { body: data.message, icon: '/icons/taskit-192.png' })
        }
      }

      socket.on('connect', handleConnect)
      socket.on('alert', handleAlert)

      if (socket.connected) socket.emit('join', userId)

      cleanupHandlers = () => {
        socket.off('alert', handleAlert)
        socket.off('connect', handleConnect)
      }
    })()

    return () => {
      isMounted = false
      cleanupHandlers?.()
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
