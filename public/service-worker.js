// src/service-worker.js

// 👇 VERSIÓN v12: Esto le indica al navegador que hay cambios importantes y debe actualizarse.
const CACHE_NAME = 'minegocio-pos-v12-FIX_MOBILE_404';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo192.png',
  '/logo512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
];

// 1. INSTALACIÓN: Forzamos a que el nuevo SW entre de inmediato (skipWaiting)
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// 2. ACTIVACIÓN: Borramos cualquier caché vieja que no sea la v12
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            // Borramos caché vieja para evitar errores de despliegue no encontrado
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Tomar control de inmediato
});

// 3. INTERCEPTOR DE RED (FETCH)
self.addEventListener('fetch', (event) => {
  // A. Ignoramos peticiones que no sean GET (como las escrituras a Firebase)
  if (event.request.method !== 'GET') return;

  // B. Ignoramos esquemas que no sean http/https (como chrome-extension://)
  if (!event.request.url.startsWith('http')) return;

  // C. ESTRATEGIA PARA HTML (Navegación): Network First (Red primero)
  // Esto es CLAVE: Intenta ir a Vercel primero. Si Vercel responde "404" (porque la versión vieja murió),
  // bajará el index.html nuevo en lugar de quedarse con el error.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html');
      })
    );
    return;
  }

  // D. ESTRATEGIA PARA RECURSOS (JS, CSS, Imágenes): Stale-While-Revalidate
  // Carga rápido del caché, pero actualiza en segundo plano para la próxima vez.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Chequeo de seguridad antes de guardar en caché
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            // NO cachear peticiones a la API de Firestore/Google para evitar datos viejos
            if (!event.request.url.includes('firestore.googleapis.com') &&
              !event.request.url.includes('googleapis.com')) {
              try {
                cache.put(event.request, responseToCache);
              } catch (err) {
                // Ignorar errores de quota
              }
            }
          });
        }
        return networkResponse;
      }).catch(() => {
        // Si falla la red y no hay caché, el navegador manejará el error
      });

      return cachedResponse || fetchPromise;
    })
  );
});