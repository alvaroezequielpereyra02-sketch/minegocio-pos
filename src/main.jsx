import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// --- AUTO-REPARACIÓN DE ERRORES DE CARGA (CHUNK LOAD ERROR) ---
// Si un usuario tiene una versión vieja y trata de abrir una pantalla nueva, fallará.
// Esto detecta ese fallo y recarga la página para bajar la versión nueva.
window.addEventListener('error', (e) => {
  // Detectar errores de carga de módulos dinámicos (Lazy Loading)
  if (/Loading chunk [\d]+ failed/.test(e.message) ||
    /Failed to fetch dynamically imported module/.test(e.message)) {
    console.log('🔄 Nueva versión detectada. Recargando...');
    window.location.reload();
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// REGISTRO DE SERVICE WORKER
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      // Si hay una actualización esperando, forzarla
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      }

      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) return;
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('🔄 Nueva versión disponible. Recargando...');
            window.location.reload();
          }
        };
      };
    }).catch(error => {
      console.log('SW Error:', error);
    });
  });

  let refreshing;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    window.location.reload();
    refreshing = true;
  });
}