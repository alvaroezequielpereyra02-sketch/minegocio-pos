// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// 🛡️ 1. FORZAR ACTIVACIÓN INMEDIATA (Soluciona el AbortError)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

firebase.initializeApp({
    apiKey: "AIzaSyCo69kQNCYjROXTKlu9SotNuy-QeKdWXYM",
    authDomain: "minegocio-pos-e35bf.firebaseapp.com",
    projectId: "minegocio-pos-e35bf",
    storageBucket: "minegocio-pos-e35bf.firebasestorage.app",
    messagingSenderId: "613903188094",
    appId: "613903188094:web:2ed15b6fb6ff5be6fd582f"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    const { title, body, icon } = payload.notification || {};
    self.registration.showNotification(title || '¡Nuevo Pedido!', {
        body: body || 'Tienes un nuevo pedido pendiente.',
        icon: icon || '/logo192.png',
        badge: '/logo192.png',
        vibrate: [200, 100, 200],
        tag: 'pedido-nuevo',
        renotify: true,
        data: { url: payload.data?.url || '/' }
    });
});

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