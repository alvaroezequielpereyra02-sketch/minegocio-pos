// firebase-messaging-sw.js
// ✅ SW UNIFICADO: FCM + Cache + AUTO-UPDATE al detectar nueva versión

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// ─── CACHE ────────────────────────────────────────────────────────────────────
// ⚠️ IMPORTANTE: cambiar este número en cada deploy importante
// El SW detecta automáticamente si cambió y recarga la app,
// pero tener un nombre nuevo garantiza que el caché viejo se borre.
const CACHE_VERSION = 'v21';
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
  // skipWaiting: el SW nuevo toma control sin esperar que se cierren todas las pestañas
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// ─── ACTIVACIÓN ───────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Borrar TODOS los cachés viejos (cualquier versión anterior)
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
      // Tomar control de todas las pestañas abiertas inmediatamente
      self.clients.claim()
    ]).then(() => {
      // ✅ Notificar a TODOS los clientes abiertos que hay una nueva versión
      // La app React escucha este mensaje y recarga automáticamente
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

  // Navegación → SIEMPRE red primero para detectar actualizaciones
  // Si falla (offline), servir index.html del caché
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Guardar la respuesta más reciente de index.html
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
             <body style="font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:16px;background:#111827;color:#f8fafc;margin:0">
               <div style="font-size:48px">📶</div>
               <h2 style="margin:0">Sin conexión</h2>
               <p style="margin:0;color:#94a3b8;text-align:center;max-width:280px">Necesitás conexión para abrir la app por primera vez.</p>
               <button onclick="location.reload()" style="background:#f97316;color:white;border:none;padding:12px 24px;border-radius:12px;font-size:14px;font-weight:bold;cursor:pointer">Reintentar</button>
             </body></html>`,
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }

  // Assets con hash (JS/CSS de Vite) → caché primero, actualiza en background
  // Los assets de Vite tienen hash en el nombre → son inmutables → ok cachearlos
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

  // Resto → red primero (imágenes de Firebase Storage, APIs, etc.)
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
