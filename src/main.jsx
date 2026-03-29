import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import ErrorBoundary from './components/ErrorBoundary';
import ResetPasswordPage from './components/ResetPasswordPage';

// --- 1. IMPORTAR LOS PROVEEDORES DE CONTEXTO ---
import { AuthProvider } from './context/AuthContext';
import { InventoryProvider } from './context/InventoryContext';
import { CartProvider } from './context/CartContext';
import { TransactionsProvider } from './context/TransactionsContext';

// Autocorrección de versiones
window.addEventListener('vite:preloadError', (event) => {
  window.location.reload();
});

// ── Detección de flujo de reseteo de contraseña ───────────────────────────────
// Cuando el usuario hace click en el link del email, Firebase redirige a la app
// con ?mode=resetPassword&oobCode=... en la URL.
// Lo detectamos ANTES de montar los providers para mostrar solo la página de
// reseteo — sin necesidad de que el usuario esté autenticado.
const urlParams  = new URLSearchParams(window.location.search);
const urlMode    = urlParams.get('mode');
const oobCode    = urlParams.get('oobCode');
const isReset    = urlMode === 'resetPassword' && !!oobCode;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      {isReset ? (
        // Página de reseteo — standalone, sin providers de auth/inventory
        <ResetPasswordPage oobCode={oobCode} />
      ) : (
        // App normal con todos los providers
        <AuthProvider>
          <InventoryProvider>
            <TransactionsProvider>
              <CartProvider>
                <App />
              </CartProvider>
            </TransactionsProvider>
          </InventoryProvider>
        </AuthProvider>
      )}
    </ErrorBoundary>
  </React.StrictMode>,
)

// El Service Worker es registrado por useNotifications.js (firebase-messaging-sw.js)
// No registrar service-worker.js aquí para evitar conflictos con FCM