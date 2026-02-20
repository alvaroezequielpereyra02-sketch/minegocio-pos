// public/firebase-messaging-sw.js
// Service Worker específico para Firebase Cloud Messaging (FCM)
// Este archivo DEBE estar en /public para que Firebase lo encuentre en la raíz

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// IMPORTANTE: Estas variables son públicas (van al cliente de todos modos)
// Las credenciales sensibles están protegidas por las Firebase Security Rules
firebase.initializeApp({
    apiKey:            self.VITE_FIREBASE_API_KEY            || '__REPLACE_FIREBASE_API_KEY__',
    authDomain:        self.VITE_FIREBASE_AUTH_DOMAIN        || '__REPLACE_FIREBASE_AUTH_DOMAIN__',
    projectId:         self.VITE_FIREBASE_PROJECT_ID         || '__REPLACE_FIREBASE_PROJECT_ID__',
    storageBucket:     self.VITE_FIREBASE_STORAGE_BUCKET     || '__REPLACE_FIREBASE_STORAGE_BUCKET__',
    messagingSenderId: self.VITE_FIREBASE_MESSAGING_SENDER_ID || '__REPLACE_FIREBASE_MESSAGING_SENDER_ID__',
    appId:             self.VITE_FIREBASE_APP_ID             || '__REPLACE_FIREBASE_APP_ID__'
});

const messaging = firebase.messaging();

// Manejar mensajes en BACKGROUND (app cerrada o en segundo plano)
messaging.onBackgroundMessage((payload) => {
    const { title, body, icon } = payload.notification || {};
    self.registration.showNotification(title || '¡Nuevo Pedido!', {
        body:     body || 'Tienes un nuevo pedido pendiente.',
        icon:     icon || '/logo192.png',
        badge:    '/logo192.png',
        vibrate:  [200, 100, 200],
        tag:      'pedido-nuevo',
        renotify: true,
        data:     { url: payload.data?.url || '/' }
    });
});

// Al tocar la notificación, abrir/enfocar la app
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
