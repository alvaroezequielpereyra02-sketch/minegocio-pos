// 1. CAMBIA LA VERSIÓN AQUÍ (Incrementa este número cada vez que subas cambios a producción)
const CACHE_NAME = 'minegocio-pos-v3';

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
  // Obliga al SW a activarse inmediatamente sin esperar
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            // Borra la caché vieja (v2)
            return caches.delete(key);
          }
        })
      );
    })
  );
  // Toma el control de todos los clientes abiertos inmediatamente
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