const CACHE_NAME = 'diario-motorista-v10';
const OFFLINE_URL = '/offline';
const STATIC_ASSETS = ['/manifest.json', '/icon-192.png', '/icon-512.png', OFFLINE_URL];
const STATIC_PATHS = new Set(STATIC_ASSETS);

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => Promise.all(
      cacheNames.filter(cacheName => cacheName.startsWith('diario-motorista-') && cacheName !== CACHE_NAME)
        .map(cacheName => caches.delete(cacheName))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => {
      return await caches.match(OFFLINE_URL) || new Response('Sem conexão', { status: 503 });
    }));
    return;
  }

  if (STATIC_PATHS.has(url.pathname)) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
  }
});
