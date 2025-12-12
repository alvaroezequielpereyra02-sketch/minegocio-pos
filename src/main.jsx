import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import ErrorBoundary from './components/ErrorBoundary';

// IMPORTS DE LOS 4 CONTEXTOS
import { AuthProvider } from './context/AuthContext';
import { InventoryProvider } from './context/InventoryContext';
import { CartProvider } from './context/CartContext';
import { TransactionsProvider } from './context/TransactionsContext'; // <--- ESTE FALTABA

// Autocorrección de versiones
window.addEventListener('vite:preloadError', (event) => {
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      {/* 1. AUTENTICACIÓN (La base de todo) */}
      <AuthProvider>

        {/* 2. INVENTARIO (Necesita usuario) */}
        <InventoryProvider>

          {/* 3. TRANSACCIONES (Necesita usuario e inventario) */}
          <TransactionsProvider>

            {/* 4. CARRITO (Necesita productos del inventario) */}
            <CartProvider>

              {/* LA APLICACIÓN */}
              <App />

            </CartProvider>
          </TransactionsProvider>
        </InventoryProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)

// REGISTRO DE SERVICE WORKER
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').then(registration => {
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      }
    }).catch(err => console.log('SW Error:', err));

    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (let registration of registrations) {
        if (registration.active && registration.active.scriptURL.includes('sw.js')) {
          registration.unregister();
        }
      }
    });
  });
}