// 1. CAMBIA LA VERSIÓN AQUÍ (Incrementa este número cada vez que subas cambios a producción)
// Al pasar de v3 a v4, fuerzas a que todos los clientes borren la caché vieja.
const CACHE_NAME = 'minegocio-pos-v4';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo192.png',
  '/logo512.png',
  // Importante: Cachear la librería externa de PDF para que funcione offline
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
];

self.addEventListener('install', (event) => {
  // Obliga al SW a activarse inmediatamente sin esperar a que se cierren las pestañas
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Cacheando assets estáticos');
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
            // Borra caches viejas (ej: v1, v2, v3) para liberar espacio y evitar conflictos
            console.log('[Service Worker] Borrando caché antigua:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  // Toma el control de todos los clientes abiertos inmediatamente para que usen la nueva versión
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Ignorar peticiones que no sean GET o esquemas extraños
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) return;

  // ESTRATEGIA 1: Network First para Navegación (HTML)
  // Evita que el usuario se quede atrapado en una versión vieja de la app.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // Si falla la red (offline), devuelve el index.html de la caché
          return caches.match('/index.html');
        })
    );
    return;
  }

  // ESTRATEGIA 2: Stale-While-Revalidate para Recursos (CSS, JS, Imágenes)
  // Carga rápido desde caché, pero actualiza en segundo plano si hay cambios.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Clonar la respuesta
        const responseToCache = networkResponse.clone();

        caches.open(CACHE_NAME).then((cache) => {
          // No cachear las llamadas a la API de Firebase (Firestore lo maneja internamente)
          if (!event.request.url.includes('firestore.googleapis.com')) {
            cache.put(event.request, responseToCache);
          }
        });
        return networkResponse;
      }).catch(() => {
        // Fallback silencioso si no hay red
        // console.log("Offline y sin caché para:", event.request.url);
      });

      // Devuelve lo que haya en caché primero, si no, espera a la red
      return cachedResponse || fetchPromise;
    })
  );
});