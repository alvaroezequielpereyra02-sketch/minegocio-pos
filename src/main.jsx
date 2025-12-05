import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// REGISTRO DE SW CON AUTO-RECARGA
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
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // Nueva versión disponible -> Recargar
              console.log('🔄 Nueva versión disponible. Recargando...');
              window.location.reload();
            }
          }
        };
      };
    });
  });

  // Recargar si el SW cambia (controlador cambia)
  let refreshing;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    window.location.reload();
    refreshing = true;
  });
}