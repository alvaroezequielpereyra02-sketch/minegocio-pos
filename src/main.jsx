import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import ErrorBoundary from './components/ErrorBoundary';

// --- 1. IMPORTAR LOS PROVEEDORES DE CONTEXTO ---
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
      {/* 2. ENVOLVER LA APP CON LOS PROVEEDORES (CEREBROS) */}
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

// El Service Worker es registrado por useNotifications.js (firebase-messaging-sw.js)
// No registrar service-worker.js aquí para evitar conflictos con FCM