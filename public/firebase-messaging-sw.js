// public/firebase-messaging-sw.js
// ✅ SW UNIFICADO: maneja FCM + Cache Strategy
// Reemplaza completamente a service-worker.js

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// ─── CACHE ────────────────────────────────────────────────────────────────────
const CACHE_NAME = 'minegocio-pos-v17-FCM-unified';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo192.png',
  '/logo512.png'
];

// ─── INSTALACIÓN ──────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  // 🔑 skipWaiting garantiza que este SW tome el control de inmediato
  // y evita el AbortError al suscribirse con PushManager
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// ─── ACTIVACIÓN ───────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Limpia caches viejas
      caches.keys().then((keys) =>
        Promise.all(keys.map((key) => key !== CACHE_NAME && caches.delete(key)))
      ),
      // 🔑 clients.claim() hace que el SW controle las pestañas abiertas
      // sin necesidad de recargar → FCM puede suscribirse inmediatamente
      self.clients.claim()
    ])
  );
});

// ─── FIREBASE ─────────────────────────────────────────────────────────────────
firebase.initializeApp({
  apiKey: "AIzaSyCo69kQNCYjROXTKlu9SotNuy-QeKdWXYM",
  authDomain: "minegocio-pos-e35bf.firebaseapp.com",
  projectId: "minegocio-pos-e35bf",
  storageBucket: "minegocio-pos-e35bf.firebasestorage.app",
  messagingSenderId: "613903188094",
  appId: "1:613903188094:web:2ed15b6fb6ff5be6fd582f"
});

const messaging = firebase.messaging();

// ─── NOTIFICACIONES EN BACKGROUND (FCM) ──────────────────────────────────────
// onBackgroundMessage es el único lugar donde se muestran notificaciones.
// NO hay listener manual de 'push' para evitar duplicados con el SDK de Firebase.
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  const { url } = payload.data || {};
  self.registration.showNotification(title || '¡Nuevo Pedido!', {
    body: body || 'Tienes un nuevo pedido pendiente.',
    icon: '/logo192.png',
    badge: '/logo192.png',
    vibrate: [200, 100, 200],
    tag: 'pedido-nuevo',
    renotify: true,
    data: { url: url || '/' }
  });
});

// ─── CLICK EN NOTIFICACIÓN ────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// ─── ESTRATEGIA DE FETCH (Cache & Network) ────────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  // Navegación → intenta red primero, cae en caché si falla
  if (event.request.mode === 'navigate') {
    event.respondWith(
      Promise.race([
        fetch(event.request),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500))
      ]).catch(() => caches.match('/index.html') || caches.match('/'))
    );
    return;
  }

  // Assets → caché primero, actualiza en background
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
