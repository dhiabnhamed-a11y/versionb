'use client'

import { useEffect } from 'react'
import { enablePushNotifications, subscribeToForegroundMessages } from '@/firebase'

export default function PushNotificationBootstrap({ userId }: { userId?: string }) {
  useEffect(() => {
    if (!userId) {
      return
    }

    // Ask authenticated users for notification permission and register their FCM token.
    void enablePushNotifications()
  }, [userId])

  useEffect(() => {
    let unsubscribe = () => {}

    void (async () => {
      unsubscribe = await subscribeToForegroundMessages((payload: unknown) => {
        // Socket alerts still handle the active-tab UX. Foreground FCM is kept for debugging/extension.
        console.log('TASKIT foreground FCM message', payload)
      })
    })()

    return () => {
      unsubscribe()
    }
  }, [])

  return null
}
