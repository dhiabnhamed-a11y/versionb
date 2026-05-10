'use client'

import { useEffect } from 'react'
import { registerTaskitServiceWorker } from '@/firebase'
import { registerTaskitNotificationSoundUnlock } from '@/lib/notification-sound'

export default function PWARegistration() {
  useEffect(() => {
    // Register the main service worker once so install/offline support is available app-wide.
    void registerTaskitServiceWorker()
    registerTaskitNotificationSoundUnlock()
  }, [])

  return null
}
