import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Autocorrección de versiones
window.addEventListener('vite:preloadError', (event) => {
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// REGISTRO DE SERVICE WORKER NUEVO
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // CAMBIO IMPORTANTE: Ahora registramos '/service-worker.js'
    // Esto desinstalará automáticamente el viejo 'sw.js'
    navigator.serviceWorker.register('/service-worker.js').then(registration => {
      console.log('SW registrado:', registration.scope);

      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      }
    }).catch(err => console.log('SW Error:', err));

    // Desregistrar el viejo por si acaso queda zombie
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (let registration of registrations) {
        if (registration.active && registration.active.scriptURL.includes('sw.js')) {
          registration.unregister();
        }
      }
    });
  });
}