const TASKIT_CACHE = 'taskit-v5'
const TASKIT_OFFLINE_CACHE = 'taskit-offline-v5'
const TASKIT_DEFAULT_ICON = '/icons/taskit-192.png'
const TASKIT_DEFAULT_BADGE = '/favicon.ico'

const PRE_CACHE_URLS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/icons/taskit-192.png',
  '/icons/taskit-512.png',
]

const OFFLINE_PAGE_HTML = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>You're offline — TASKIT</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0f1e;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100dvh;padding:24px}.container{text-align:center;max-width:440px}.icon{width:64px;height:64px;margin:0 auto 24px;border-radius:16px;background:rgba(59,130,246,0.1);display:flex;align-items:center;justify-content:center;border:1px solid rgba(59,130,246,0.2)}h1{font-size:20px;font-weight:700;margin-bottom:8px}p{font-size:14px;color:#94a3b8;line-height:1.6;margin-bottom:24px}.status{display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:8px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);font-size:13px;font-weight:600;color:#fbbf24;margin-bottom:24px}.dot{width:8px;height:8px;border-radius:50%;background:#f59e0b;animation:pulse 2s ease-in-out infinite}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}.btn{display:inline-flex;align-items:center;gap:8px;padding:10px 24px;border-radius:8px;background:#3b82f6;color:#fff;font-size:14px;font-weight:600;text-decoration:none;transition:background .15s;border:none;cursor:pointer}.btn:hover{background:#2563eb}.btn svg{width:16px;height:16px}.note{margin-top:16px;font-size:12px;color:#64748b}</style></head><body><div class="container"><div class="icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0119 12.55"/><path d="M5 12.55a10.94 10.94 0 015.17-2.39"/><path d="M10.71 5.05A16 16 0 0122.56 9"/><path d="M1.42 9a15.91 15.91 0 014.7-2.88"/><path d="M8.53 16.11a6 6 0 016.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg></div><h1>You're offline</h1><p>TASKIT needs an internet connection to load this page. Your unsaved work will sync automatically when you reconnect.</p><div class="status"><span class="dot"></span> No connection</div><div><button class="btn" onclick="location.reload()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>Try again</button></div><p class="note">TASKIT Offline Mode — changes are queued and synced on reconnection.</p></div></body></html>`

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(TASKIT_CACHE)
    await Promise.allSettled(PRE_CACHE_URLS.map((url) => cache.add(url)))
    const offlineCache = await caches.open(TASKIT_OFFLINE_CACHE)
    await offlineCache.put(
      new Request('/__offline'),
      new Response(OFFLINE_PAGE_HTML, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    )
  })())
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(
      keys
        .filter((key) => key !== TASKIT_CACHE && key !== TASKIT_OFFLINE_CACHE)
        .map((key) => caches.delete(key))
    )
    await self.clients.claim()
  })())
})

function shouldBypassWorker(request, url) {
  return (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.endsWith('.pdf') ||
    (request.headers.get('accept') || '').includes('application/pdf') ||
    (request.headers.get('accept') || '').includes('application/octet-stream') ||
    (request.headers.get('cache-control') || '').includes('no-store')
  )
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    /\.(css|js|png|jpg|jpeg|svg|webp|ico|woff2?)$/i.test(url.pathname)
  )
}

function isNavigationalHtml(url) {
  return !isStaticAsset(url) && !/\.\w{2,4}$/i.test(url.pathname)
}

async function networkFirstThenCache(request) {
  try {
    const response = await fetch(request)
    if (response && response.ok) {
      const copy = response.clone()
      void caches.open(TASKIT_CACHE).then((cache) => cache.put(request, copy))
    }
    return response
  } catch {
    return null
  }
}

async function cacheFirstThenNetwork(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response && response.ok) {
      const copy = response.clone()
      void caches.open(TASKIT_CACHE).then((cache) => cache.put(request, copy))
    }
    return response
  } catch {
    return null
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (shouldBypassWorker(request, url)) return

  if (request.mode === 'navigate' || isNavigationalHtml(url)) {
    event.respondWith(
      (async () => {
        const networkResponse = await networkFirstThenCache(request)
        if (networkResponse) return networkResponse
        const cachedRoot = await caches.match('/')
        if (cachedRoot) return cachedRoot
        const offlinePage = await caches.match('/__offline')
        if (offlinePage) return offlinePage
        return new Response(OFFLINE_PAGE_HTML, {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      })()
    )
    return
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const result = await cacheFirstThenNetwork(request)
        return result || new Response('', { status: 503 })
      })()
    )
    return
  }
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
  if (!event.data) return null
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
  if (!notification) return
  event.waitUntil(
    self.registration.showNotification(notification.title, {
      body: notification.body,
      icon: notification.icon,
      badge: notification.badge,
      tag: notification.tag,
      silent: false,
      data: { url: notification.url },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = new URL(event.notification.data?.url || '/dashboard', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin) {
          if ('focus' in client) {
            if ('navigate' in client) return client.navigate(targetUrl).then((focusedClient) => focusedClient.focus())
            return client.focus()
          }
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
    })
  )
})
