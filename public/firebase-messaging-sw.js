// firebase-messaging-sw.js
// ✅ SW UNIFICADO: FCM + Cache + AUTO-UPDATE al detectar nueva versión

importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js');

// ─── CACHE ────────────────────────────────────────────────────────────────────
// ⚠️ IMPORTANTE: cambiar este número en cada deploy importante
const CACHE_VERSION = 'v22';
const CACHE_NAME = `minegocio-pos-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo192.png',
  '/logo512.png'
];

// ─── INSTALACIÓN ──────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// ─── ACTIVACIÓN ───────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => {
              console.log('[SW] Borrando caché viejo:', key);
              return caches.delete(key);
            })
        )
      ),
      self.clients.claim()
    ]).then(() => {
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION });
        });
      });
    })
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

// ─── ESTRATEGIA DE FETCH ──────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match('/index.html') || await caches.match('/');
          if (cached) return cached;
          return new Response(
            `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MiNegocio</title></head>
             <body style="font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:16px;background:#2C1810;color:#f8fafc;margin:0">
               <div style="font-size:48px">📶</div>
               <h2 style="margin:0">Sin conexión</h2>
               <p style="margin:0;color:#94a3b8;text-align:center;max-width:280px">Necesitás conexión para abrir la app por primera vez.</p>
               <button onclick="location.reload()" style="background:#8B6914;color:white;border:none;padding:12px 24px;border-radius:12px;font-size:14px;font-weight:bold;cursor:pointer">Reintentar</button>
             </body></html>`,
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }

  if (event.request.url.includes('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
