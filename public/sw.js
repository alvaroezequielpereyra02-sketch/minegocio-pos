// 1. CAMBIA ESTA VERSIÓN PARA FORZAR ACTUALIZACIÓN EN CELULARES
const CACHE_NAME = 'minegocio-pos-v8';

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
  // --- REGLA DE ORO: SI NO ES GET, IGNORAR ---
  // Esto evita el error "Request method 'POST' is unsupported"
  if (event.request.method !== 'GET') return;

  // Ignorar urls extrañas
  if (!event.request.url.startsWith('http')) return;

  // ESTRATEGIA 1: HTML (Navegación) -> INTENTAR RED PRIMERO
  // Esto arregla los errores 404 al subir nuevas versiones
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // ESTRATEGIA 2: Archivos Estáticos -> CACHÉ PRIMERO, LUEGO RED
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Si está en caché, úsalo
      if (cachedResponse) return cachedResponse;

      // Si no, búscalo en la red
      return fetch(event.request).then((networkResponse) => {
        // Solo guardar en caché si la respuesta es válida (200 OK)
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          // NO cachear nada de Firebase/Firestore
          if (!event.request.url.includes('firestore.googleapis.com')) {
            cache.put(event.request, responseToCache);
          }
        });
        return networkResponse;
      });
    })
  );
});