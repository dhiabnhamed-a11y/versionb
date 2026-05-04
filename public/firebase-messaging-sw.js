const TASKIT_DEFAULT_ICON = '/icons/taskit-192.png'
const TASKIT_DEFAULT_BADGE = '/favicon.ico'

try {
  importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js')
  importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js')
} catch {
  // FCM compat scripts are optional here; raw PushEvent handling below still displays data messages.
}

function parseTaskitPushPayload(event) {
  if (!event.data) {
    return null
  }

  try {
    const payload = event.data.json()
    const data = payload?.data ?? {}
    const notification = payload?.notification ?? {}
    const fcmOptions = payload?.fcmOptions ?? payload?.webpush?.fcm_options ?? {}

    return {
      title: data.title || notification.title || 'TASKIT',
      body: data.body || notification.body || 'You have a new notification.',
      icon: data.icon || notification.icon || TASKIT_DEFAULT_ICON,
      badge: data.badge || TASKIT_DEFAULT_BADGE,
      url: data.url || fcmOptions.link || '/dashboard',
      tag: data.tag || data.alertId || 'taskit-alert',
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

  const targetUrl = new URL(event.notification.data?.url || '/dashboard', self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client && new URL(client.url).origin === self.location.origin) {
          if ('navigate' in client) {
            return client.navigate(targetUrl).then((focusedClient) => focusedClient.focus())
          }

          return client.focus()
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }

      return undefined
    })
  )
})
