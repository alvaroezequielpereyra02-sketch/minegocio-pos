import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)

// --- REGISTRO DEL SERVICE WORKER (SW) PARA PWA ---
// Este código es vital para que la App sea reconocida como instalable (WebAPK)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Registramos el Service Worker ubicado en public/sw.js
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(registration => {
        console.log('✅ SW registrado con éxito desde main.jsx:', registration.scope);
      })
      .catch(error => {
        console.error('❌ Falló el registro del SW:', error);
      });
  });
}
