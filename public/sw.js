const CACHE_NAME = 'nivel-shell-v6'
const APP_SHELL = ['/', '/login', '/manifest.webmanifest', '/nivel-mark.svg', '/icons/icon-192.png', '/icons/icon-512.png']

function cacheResponse(event, key, response) {
  if (!response.ok) return
  // Clone before returning the original response to the browser.
  const copy = response.clone()
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.put(key, copy))
      .catch(error => console.warn('No se pudo actualizar la caché:', error))
  )
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          cacheResponse(event, '/', response)
          return response
        })
        .catch(() => caches.match('/'))
    )
    return
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || ['/nivel-mark.svg', '/manifest.webmanifest'].includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(response => {
        cacheResponse(event, request, response)
        return response
      }))
    )
  }
})
