import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Autocorrección de errores de carga (Chunk Load Error)
window.addEventListener('vite:preloadError', (event) => {
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// REGISTRO Y ACTUALIZACIÓN AUTOMÁTICA DE SERVICE WORKER
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {

      // 1. Detectar si hay una actualización esperando
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      // 2. Escuchar cuando se detecta una nueva versión en el servidor
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // Nueva versión instalada -> Forzamos al usuario a verla
            console.log("Nueva versión detectada. Actualizando...");
            // Opcional: Podrías mostrar un aviso aquí, pero pediste automático:
            if (newWorker) newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    });

    // 3. Cuando el SW toma el control (después de skipWaiting), recargar la página
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}