import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// --- AUTOCORRECTOR DE VERSIONES ---
// Si un archivo falla al cargar (porque actualizaste la app), recarga la página.
window.addEventListener('vite:preloadError', (event) => {
  window.location.reload();
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

      // Si hay una actualización esperando, fuérzala
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      }

      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) return;
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('Nueva versión disponible. Actualizando...');
            window.location.reload();
          }
        };
      };
    });
  });

  let refreshing;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    window.location.reload();
    refreshing = true;
  });
}