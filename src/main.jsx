import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import ErrorBoundary from './components/ErrorBoundary';

// --- IMPORTANTE: IMPORTAR LOS PROVEEDORES DE CONTEXTO ---
import { AuthProvider } from './context/AuthContext';
import { InventoryProvider } from './context/InventoryContext';
import { CartProvider } from './context/CartContext';
import { TransactionsProvider } from './context/TransactionsContext';

// Autocorrección de versiones
window.addEventListener('vite:preloadError', (event) => {
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      {/* 1. Proveedor de Autenticación (El más externo) */}
      <AuthProvider>

        {/* 2. Proveedor de Inventario (Productos, Clientes) */}
        <InventoryProvider>

          {/* 3. Proveedor de Transacciones (Ventas, Historial) */}
          <TransactionsProvider>

            {/* 4. Proveedor de Carrito (Depende de productos) */}
            <CartProvider>

              {/* LA APP PRINCIPAL */}
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