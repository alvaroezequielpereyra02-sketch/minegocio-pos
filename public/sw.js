const CACHE_NAME = 'minegocio-pos-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo192.png',
  '/logo512.png',
  // Importante: Cachear la librería externa de PDF
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
];

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Cacheando assets estáticos');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activado');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Borrando caché antigua:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Ignorar peticiones que no sean GET o que sean a chrome-extension
  if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension')) return;

  // Estrategia Stale-While-Revalidate para la mayoría de recursos
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Clonar la respuesta porque solo se puede consumir una vez
        const responseToCache = networkResponse.clone();

        caches.open(CACHE_NAME).then((cache) => {
          // No cachear las llamadas a la API de Firebase (Firestore lo maneja internamente)
          if (!event.request.url.includes('firestore.googleapis.com')) {
            cache.put(event.request, responseToCache);
          }
        });
        return networkResponse;
      }).catch(() => {
        // Si falla la red y no hay caché (ej: primera carga offline)
        console.log("Offline y sin caché para:", event.request.url);
      });

      return cachedResponse || fetchPromise;
    })
  );
});