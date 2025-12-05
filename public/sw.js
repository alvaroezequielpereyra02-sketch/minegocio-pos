// 1. CAMBIA ESTA VERSIÓN CADA VEZ QUE SUBAS CAMBIOS (Ej: v5, v6...)
const CACHE_NAME = 'minegocio-pos-v5';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo192.png',
  '/logo512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
];

// INSTALACIÓN: Cachea lo básico
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Fuerza al SW a activarse de inmediato
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Cacheando assets estáticos');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// ACTIVACIÓN: Borra cachés viejas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Borrando caché vieja:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Toma el control de la página inmediatamente
});

// INTERCEPTOR DE RED (FETCH)
self.addEventListener('fetch', (event) => {
  // Ignoramos peticiones que no sean http (como chrome-extension)
  if (!event.request.url.startsWith('http')) return;

  // ESTRATEGIA CRÍTICA: Network First para el HTML (Navegación)
  // Esto evita la pantalla blanca al obligar a buscar el index.html nuevo
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // Solo si no hay internet, devuelve el de la caché
          return caches.match('/index.html');
        })
    );
    return;
  }

  // ESTRATEGIA: Stale-While-Revalidate para recursos estáticos (JS, CSS, Imágenes)
  // Usa la caché para velocidad, pero actualiza en segundo plano
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Si la respuesta es válida, actualizamos la caché
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            if (!event.request.url.includes('firestore.googleapis.com')) {
              cache.put(event.request, responseToCache);
            }
          });
        }
        return networkResponse;
      }).catch(() => {
        // Fallback silencioso si falla la red
      });

      // Devuelve la caché si existe, sino espera a la red
      return cachedResponse || fetchPromise;
    })
  );
});