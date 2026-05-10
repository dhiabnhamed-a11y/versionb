'use client'

import { useEffect } from 'react'
import {
  extractTaskitNotification,
  refreshPushTokenIfNeeded,
  syncGrantedPushToken,
  subscribeToForegroundMessages,
} from '@/firebase'
import {
  playTaskitNotificationSound,
  registerTaskitNotificationSoundUnlock,
} from '@/lib/notification-sound'

export default function PushNotificationBootstrap({ userId }: { userId?: string }) {
  useEffect(() => {
    if (!userId) {
      return
    }

    registerTaskitNotificationSoundUnlock()
    void syncGrantedPushToken()

    const refreshTimer = window.setInterval(() => {
      void refreshPushTokenIfNeeded()
    }, 1000 * 60 * 60)

    return () => window.clearInterval(refreshTimer)
  }, [userId])

  useEffect(() => {
    let unsubscribe = () => {}

    void (async () => {
      unsubscribe = await subscribeToForegroundMessages((payload: unknown) => {
        const notification = extractTaskitNotification(payload)

        window.dispatchEvent(new CustomEvent('taskit:fcm-message', { detail: payload }))
        void playTaskitNotificationSound()

        if ('Notification' in window && Notification.permission === 'granted') {
          const shown = new Notification(notification.title, {
            body: notification.body,
            icon: notification.icon,
            badge: notification.badge,
            tag: notification.tag,
          })

          shown.onclick = () => {
            window.focus()
            window.location.assign(notification.url)
            shown.close()
          }
        }
      })
    })()

    return () => {
      unsubscribe()
    }
  }, [])

  return null
}
