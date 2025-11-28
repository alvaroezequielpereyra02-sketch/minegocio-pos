// Service Worker Mínimo y Robusto (Solo registra, no interfiere con la red)

self.addEventListener('install', (e) => {
  console.log('SW: Instalado');
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  console.log('SW: Activado');
  // Reclamar inmediatamente a todos los clientes
  e.waitUntil(clients.claim());
});

// IMPORTANTÍSIMO: Ya NO ponemos un listener para 'fetch'
// Esto evita el error TypeError y deja que el navegador maneje las peticiones de red.
