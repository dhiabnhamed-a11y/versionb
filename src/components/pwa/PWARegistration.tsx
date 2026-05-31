'use client'

import { useEffect } from 'react'
import { registerTaskitServiceWorker } from '@/firebase'
import { registerTaskitNotificationSoundUnlock } from '@/lib/notification-sound'

export default function PWARegistration() {
  useEffect(() => {
    function handleControllerChange() {
      const reloadKey = 'taskit-sw-controller-reloaded'
      if (sessionStorage.getItem(reloadKey) === '1') return
      sessionStorage.setItem(reloadKey, '1')
      window.location.reload()
    }

    // Register the main service worker once so install/offline support is available app-wide.
    void registerTaskitServiceWorker()
    registerTaskitNotificationSoundUnlock()

    navigator.serviceWorker?.addEventListener('controllerchange', handleControllerChange)

    return () => {
      navigator.serviceWorker?.removeEventListener('controllerchange', handleControllerChange)
    }
  }, [])

  return null
}
