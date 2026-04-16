const TASKIT_DEFAULT_ICON = '/icons/taskit-192.png'
const TASKIT_DEFAULT_BADGE = '/favicon.ico'

function parseTaskitPushPayload(event) {
  if (!event.data) {
    return null
  }

  try {
    const payload = event.data.json()
    const data = payload?.data ?? payload?.notification ?? payload ?? {}

    return {
      title: data.title || 'TASKIT',
      body: data.body || 'You have a new notification.',
      icon: data.icon || TASKIT_DEFAULT_ICON,
      badge: data.badge || TASKIT_DEFAULT_BADGE,
      url: data.url || '/dashboard',
      tag: data.tag || 'taskit-alert',
    }
  } catch {
    return {
      title: 'TASKIT',
      body: event.data.text(),
      icon: TASKIT_DEFAULT_ICON,
      badge: TASKIT_DEFAULT_BADGE,
      url: '/dashboard',
      tag: 'taskit-alert',
    }
  }
}

self.addEventListener('push', (event) => {
  const notification = parseTaskitPushPayload(event)
  if (!notification) {
    return
  }

  // Background push notifications are displayed here for FCM data messages.
  event.waitUntil(
    self.registration.showNotification(notification.title, {
      body: notification.body,
      icon: notification.icon,
      badge: notification.badge,
      tag: notification.tag,
      data: {
        url: notification.url,
      },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url || '/dashboard'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          return client.focus().then(() => {
            if ('navigate' in client) {
              return client.navigate(targetUrl)
            }
            return undefined
          })
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }

      return undefined
    })
  )
})
