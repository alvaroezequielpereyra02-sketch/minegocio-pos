// Aumentamos versión para forzar actualización
const CACHE_NAME = 'minegocio-pos-v6-fix';

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
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // 1. FILTRO DE SEGURIDAD: Ignorar peticiones a la API de Google/Firestore
  // Esto soluciona el error "Failed to convert value to Response"
  const url = event.request.url;
  if (url.includes('firestore.googleapis.com') ||
    url.includes('googleapis.com') ||
    url.startsWith('chrome-extension')) {
    return; // Dejar que el navegador maneje la red normal
  }

  // 2. Estrategia para Navegación (HTML)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // 3. Estrategia para Archivos Estáticos (JS, CSS, Imágenes)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Si está en caché, lo devolvemos y actualizamos en segundo plano
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Si falla la red, no hacemos nada (ya devolvimos caché si existía)
      });

      return cachedResponse || fetchPromise;
    })
  );
});