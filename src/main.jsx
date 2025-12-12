import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import ErrorBoundary from './components/ErrorBoundary';

// IMPORTS DE LOS 4 CONTEXTOS
import { AuthProvider } from './context/AuthContext';
import { InventoryProvider } from './context/InventoryContext';
import { CartProvider } from './context/CartContext';
import { TransactionsProvider } from './context/TransactionsContext';

// Autocorrección de versiones (Manejo suave de errores de carga)
window.addEventListener('vite:preloadError', (event) => {
  console.warn("Error de precarga detectado, recargando página...");
  event.preventDefault(); // Previene el error por defecto
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <InventoryProvider>
          <TransactionsProvider>
            <CartProvider>
              <App />
            </CartProvider>
          </TransactionsProvider>
        </InventoryProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)

// --- REGISTRO DE SERVICE WORKER (VERSIÓN ANTI-BUCLE) ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {

    // 1. Registrar el SW
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        // console.log('SW registrado:', registration.scope);

        // Si el SW está esperando, no forzamos recarga inmediata.
        // Dejamos que el propio SW (que tiene self.skipWaiting) haga su trabajo.
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      })
      .catch(err => console.log('SW Error:', err));

    // 2. Limpieza de SW viejos (zombies)
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (let registration of registrations) {
        if (registration.active && registration.active.scriptURL.includes('sw.js')) {
          registration.unregister();
        }
      }
    });

    // 3. RECARGA SEGURA: Solo recargar cuando el control cambie REALMENTE
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}