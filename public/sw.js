const TASKIT_STATIC_CACHE = 'taskit-static-v2'
const TASKIT_RUNTIME_CACHE = 'taskit-runtime-v2'
const TASKIT_APP_SHELL = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/icons/taskit-192.png',
  '/icons/taskit-512.png',
]

// Reuse the same worker for background push handling so TASKIT does not register competing workers.
try {
  importScripts('/firebase-messaging-sw.js')
} catch {
  // Ignore optional background messaging bootstrap failures during local development.
}

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

function isStaticAssetRequest(request, url) {
  return (
    request.destination === 'style'
    || request.destination === 'script'
    || request.destination === 'image'
    || url.pathname.startsWith('/_next/static/')
    || /\.(?:css|js|png|jpg|jpeg|svg|webp|ico|woff2?)$/i.test(url.pathname)
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

  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return
  }

  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/')) {
    return
  }

  if (request.mode === 'navigate') {
    // Keep HTML network-first so authenticated and dynamic pages stay fresh.
    event.respondWith(
      fetchAndCache(request)
        .then((response) => {
          return response
        })
        .catch(async () => {
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
    return
  }

  event.respondWith(
    fetchAndCache(request)
      .then((response) => response)
      .catch(async () => (await caches.match(request)) || emptyFallbackResponse(request))
  )
})
