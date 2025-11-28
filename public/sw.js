// Service Worker mínimo para que sea instalable (PWA)
self.addEventListener('install', (e) => {
  console.log('Service Worker: Instalado');
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  console.log('Service Worker: Activo');
});

self.addEventListener('fetch', (e) => {
  // Simplemente responde a las peticiones, necesario para PWA
  e.respondWith(fetch(e.request));
});
