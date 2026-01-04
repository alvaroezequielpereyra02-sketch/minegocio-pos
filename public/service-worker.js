// public/service-worker.js

// Incrementamos versión para forzar actualización en el cliente
const CACHE_NAME = 'minegocio-pos-v13-OFFLINE-ULTRA';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo192.png',
  '/logo512.png'
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
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  // --- ESTRATEGIA PARA NAVEGACIÓN (index.html) ---
  // Cambiamos a un enfoque que priorice la velocidad offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      // Intentamos cargar de la red, pero con un tiempo de espera muy corto (2 segundos)
      // para que si el móvil está "colgado" sin señal, salte al caché rápido.
      Promise.race([
        fetch(event.request),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500))
      ]).catch(() => {
        return caches.match('/index.html') || caches.match('/');
      })
    );
    return;
  }

  // --- ESTRATEGIA PARA ASSETS (JS, CSS, Imágenes) ---
  // Stale-While-Revalidate: Sirve del caché pero actualiza en silencio.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            // Evitamos cachear APIs de Firebase para no tener datos viejos
            if (!event.request.url.includes('firestore.googleapis.com')) {
              cache.put(event.request, responseToCache);
            }
          });
        }
        return networkResponse;
      }).catch(() => null);

      return cachedResponse || fetchPromise;
    })
  );
});