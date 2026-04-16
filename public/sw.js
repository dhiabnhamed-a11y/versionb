const TASKIT_STATIC_CACHE = 'taskit-static-v1'
const TASKIT_RUNTIME_CACHE = 'taskit-runtime-v1'
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
    caches.open(TASKIT_STATIC_CACHE).then((cache) => cache.addAll(TASKIT_APP_SHELL))
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

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return
  }

  if (url.pathname.startsWith('/api/')) {
    return
  }

  if (request.mode === 'navigate') {
    // Keep HTML network-first so authenticated and dynamic pages stay fresh.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          void caches.open(TASKIT_RUNTIME_CACHE).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(async () => {
          const cachedPage = await caches.match(request)
          return cachedPage || caches.match('/')
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

        return fetch(request).then((response) => {
          const copy = response.clone()
          void caches.open(TASKIT_RUNTIME_CACHE).then((cache) => cache.put(request, copy))
          return response
        })
      })
    )
    return
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone()
        void caches.open(TASKIT_RUNTIME_CACHE).then((cache) => cache.put(request, copy))
        return response
      })
      .catch(() => caches.match(request))
  )
})
