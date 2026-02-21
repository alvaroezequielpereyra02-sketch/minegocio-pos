// public/firebase-messaging-sw.js
// ✅ SW UNIFICADO: maneja FCM + Cache Strategy
// Reemplaza completamente a service-worker.js

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// ─── CACHE ────────────────────────────────────────────────────────────────────
const CACHE_NAME = 'minegocio-pos-v20-FCM-unified';

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
// Maneja dos tipos de payload:
// - Móvil: data-only → lee de payload.data (evita duplicados con el sistema Android)
// - Desktop: notification → lee de payload.notification
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || '¡Nuevo Pedido!';
  const body = payload.notification?.body || payload.data?.body || 'Tienes un nuevo pedido pendiente.';
  const url = payload.data?.url || '/';

  self.registration.showNotification(title, {
    body,
    icon: '/logo192.png',
    badge: '/logo192.png',
    vibrate: [200, 100, 200],
    tag: 'pedido-nuevo',
    renotify: true,
    data: { url }
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

  // Navegación → red primero con timeout generoso, siempre cae en index.html si falla
  // ✅ Timeout de 8s (era 2500ms) para dar tiempo en conexiones lentas
  // ✅ Fallback encadenado: index.html → / → respuesta de error útil (no pantalla en blanco)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      Promise.race([
        fetch(event.request),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000))
      ]).catch(async () => {
        const cached = await caches.match('/index.html') || await caches.match('/');
        if (cached) return cached;
        // Si por alguna razón el caché está vacío, devolvemos una página mínima
        // en lugar de una pantalla en blanco o el error nativo del browser
        return new Response(
          `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MiNegocio</title></head>
           <body style="font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:16px;background:#f8fafc;color:#334155;margin:0">
             <div style="font-size:48px">📶</div>
             <h2 style="margin:0">Sin conexión</h2>
             <p style="margin:0;color:#64748b;text-align:center;max-width:280px">Necesitás conexión para abrir la app por primera vez.<br>Una vez abierta, funciona sin internet.</p>
             <button onclick="location.reload()" style="background:#2563eb;color:white;border:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer">Reintentar</button>
           </body></html>`,
          { headers: { 'Content-Type': 'text/html' } }
        );
      })
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
