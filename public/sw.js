/// <reference lib="webworker" />

const CACHE_NAME = 'diario-motorista-v1';
const OFFLINE_URL = '/offline';

// Arquivos para cachear
const STATIC_ASSETS = [
  '/',
  '/login',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/offline'
];

// Instalar service worker
self.addEventListener('install', (event: any) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  (self as any).skipWaiting();
});

// Ativar service worker
self.addEventListener('activate', (event: any) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
    })
  );
  (self as any).clients.claim();
});

// Interceptar requisições
self.addEventListener('fetch', (event: any) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requisições não-GET
  if (request.method !== 'GET') {
    // Para POST/PUT/DELETE, tentar sincronizar depois se offline
    if (!navigator.onLine) {
      event.respondWith(
        new Response(JSON.stringify({ 
          error: 'offline', 
          message: 'Dados salvos localmente. Sincronize quando estiver online.' 
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      return;
    }
    return;
  }

  // Estratégia: Network First, fallback para Cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cachear resposta bem-sucedida
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback para cache
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // Página offline para navegação
          if (request.mode === 'navigate') {
            return caches.match('/offline') as Promise<Response>;
          }
          
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// Sincronização em background
self.addEventListener('sync', (event: any) => {
  if (event.tag === 'sync-offline-data') {
    event.waitUntil(syncOfflineData());
  }
});

async function syncOfflineData() {
  // Esta função será chamada quando o dispositivo voltar online
  console.log('Sincronizando dados offline...');
}

// Notificações
self.addEventListener('push', (event: any) => {
  const data = event.data?.json() || {};
  
  event.waitUntil(
    (self as any).registration.showNotification(data.title || 'Diário do Motorista', {
      body: data.body || 'Nova notificação',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: data.url || '/'
    })
  );
});

self.addEventListener('notificationclick', (event: any) => {
  event.notification.close();
  event.waitUntil(
    (self as any).clients.openWindow(event.notification.data || '/')
  );
});
