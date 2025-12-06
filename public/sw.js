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
  // Obliga al SW a activarse inmediatamente, reemplazando al anterior
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Intentamos cachear, pero si falla uno no detenemos la instalación
      return cache.addAll(STATIC_ASSETS).catch(err => console.log("Error caching assets", err));
    })
  );
});

self.addEventListener('activate', (event) => {
  // Toma el control de todos los clientes abiertos inmediatamente (sin recargar)
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Borrando caché antigua:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim()) // IMPORTANTE: Reclama el control de la página de inmediato
  );
});


self.addEventListener('fetch', (event) => {
  // Ignorar peticiones que no sean GET o que sean a chrome-extension
  if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension')) return;

  // ESTRATEGIA: Network First para HTML (Navegación)
  // Esto es vital: siempre intenta bajar el index.html nuevo. Si falla, usa el caché.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match('/index.html');
        })
    );
    return;
  }

  // Estrategia Stale-While-Revalidate para la mayoría de recursos (JS, CSS, Imágenes)
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