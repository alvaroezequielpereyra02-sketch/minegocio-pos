// public/service-worker.js

// Incrementamos versión para forzar actualización en el cliente
const CACHE_NAME = 'minegocio-pos-v14-PUSH-READY'; // Actualizado a v14

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo192.png',
  '/logo512.png'
];

// --- INSTALACIÓN Y ACTIVACIÓN ---
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

// --- LÓGICA DE NOTIFICACIONES NATIVAS ---

// 1. Escuchar el evento 'push' del sistema
self.addEventListener('push', (event) => {
  let data = { title: 'Nuevo Pedido', body: 'Tienes un nuevo pedido pendiente.' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Nuevo Pedido', body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: '/logo192.png', // Icono de la app
    badge: '/logo192.png', // Icono pequeño en la barra de estado
    vibrate: [200, 100, 200],
    tag: 'pedido-nuevo', // Agrupa notificaciones para no saturar
    renotify: true,
    data: { url: '/' } // URL a abrir al hacer click
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 2. Manejar el click en la notificación
self.addEventListener('notificationclick', (event) => {
  event.notification.close(); // Cierra la notificación al tocarla

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si la app ya está abierta, ponerla en foco
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // Si no está abierta, abrir una nueva ventana
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// --- ESTRATEGIA DE FETCH (Cache & Network) ---
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  // Estrategia para navegación (index.html)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      Promise.race([
        fetch(event.request),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500))
      ]).catch(() => {
        return caches.match('/index.html') || caches.match('/');
      })
    );
    return;
  }

  // Estrategia para Assets (JS, CSS, Imágenes)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
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