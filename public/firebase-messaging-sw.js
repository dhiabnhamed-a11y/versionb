const TASKIT_STATIC_CACHE = 'taskit-static-v4'
const TASKIT_RUNTIME_CACHE = 'taskit-runtime-v4'
const TASKIT_DEFAULT_ICON = '/icons/taskit-192.png'
const TASKIT_DEFAULT_BADGE = '/favicon.ico'
const TASKIT_APP_SHELL = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/icons/taskit-192.png',
  '/icons/taskit-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(TASKIT_STATIC_CACHE).then((cache) =>
      Promise.allSettled(TASKIT_APP_SHELL.map((url) => cache.add(url)))
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![TASKIT_STATIC_CACHE, TASKIT_RUNTIME_CACHE].includes(key))
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

function getPayloadData(payload) {
  return payload?.data?.FCM_MSG?.data ?? payload?.data ?? {}
}

function getPayloadNotification(payload) {
  return payload?.data?.FCM_MSG?.notification ?? payload?.notification ?? {}
}

function getPayloadFcmOptions(payload) {
  return payload?.data?.FCM_MSG?.fcmOptions ?? payload?.fcmOptions ?? payload?.webpush?.fcm_options ?? {}
}

function parseTaskitPushPayload(event) {
  if (!event.data) {
    return null
  }

  try {
    const payload = event.data.json()
    const data = getPayloadData(payload)
    const notification = getPayloadNotification(payload)
    const fcmOptions = getPayloadFcmOptions(payload)

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

function isStaticAssetRequest(request, url) {
  return (
    request.destination === 'style'
    || request.destination === 'script'
    || request.destination === 'image'
    || url.pathname.startsWith('/_next/static/')
    || /\.(?:css|js|png|jpg|jpeg|svg|webp|ico|woff2?)$/i.test(url.pathname)
  )
}

function shouldBypassWorker(request, url) {
  const accept = request.headers.get('accept') || ''
  const cacheControl = request.headers.get('cache-control') || ''

  return (
    request.method !== 'GET'
    || url.origin !== self.location.origin
    || url.pathname.startsWith('/api/')
    || url.pathname.startsWith('/_next/')
    || url.pathname.endsWith('.pdf')
    || accept.includes('application/pdf')
    || accept.includes('application/octet-stream')
    || cacheControl.includes('no-store')
  )
}

function canCacheResponse(response) {
  return response && response.ok && ['basic', 'cors'].includes(response.type)
}

async function fetchAndCache(request) {
  const response = await fetch(request)

  if (canCacheResponse(response)) {
    const copy = response.clone()
    void caches.open(TASKIT_RUNTIME_CACHE).then((cache) => cache.put(request, copy))
  }

  return response
}

function emptyFallbackResponse(request) {
  const headers = new Headers({ 'Cache-Control': 'no-store' })

  if (request.destination === 'style') {
    headers.set('Content-Type', 'text/css; charset=utf-8')
  } else if (request.destination === 'script') {
    headers.set('Content-Type', 'application/javascript; charset=utf-8')
  } else {
    headers.set('Content-Type', 'text/plain; charset=utf-8')
  }

  return new Response('', {
    status: 503,
    statusText: 'Service worker fetch failed',
    headers,
  })
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (shouldBypassWorker(request, url)) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetchAndCache(request).catch(async () => {
        const cachedPage = await caches.match(request)
        return cachedPage || caches.match('/') || emptyFallbackResponse(request)
      })
    )
    return
  }

  if (isStaticAssetRequest(request, url)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse
        }

        return fetchAndCache(request).catch(() => emptyFallbackResponse(request))
      })
    )
  }
})
