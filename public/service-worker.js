// src/service-worker.js

// CAMBIA ESTO (Sube el número para que el navegador sepa que es nuevo)
const CACHE_NAME = 'minegocio-pos-v0.11-LAYOUT_FIX';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo192.png',
  '/logo512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // 1. REGLA DE ORO: Ignorar POST, PUT, DELETE
  if (event.request.method !== 'GET') return;

  // 2. Ignorar esquemas no HTTP
  if (!event.request.url.startsWith('http')) return;

  // 3. HTML: Red primero (evita pantalla blanca al actualizar)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // 4. Recursos: Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Chequeo extra de seguridad antes de cachear
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            if (!event.request.url.includes('firestore.googleapis.com')) {
              try {
                cache.put(event.request, responseToCache);
              } catch (err) {
                console.warn('Error cacheando:', err);
              }
            }
          });
        }
        return networkResponse;
      }).catch(() => { });

      return cachedResponse || fetchPromise;
    })
  );
});