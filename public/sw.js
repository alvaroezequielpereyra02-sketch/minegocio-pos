self.addEventListener('install', (e) => {
  console.log('[Service Worker] Install');
});
self.addEventListener('fetch', (e) => {
  // Solo pasamos la petición, no hacemos nada especial
});
