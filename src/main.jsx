import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary';
import ResetPasswordPage from './components/ResetPasswordPage';

import { queryClient } from './lib/queryClient.js';

// Contextos existentes (se migran progresivamente a lo largo de las fases)
import { AuthProvider }         from './context/AuthContext';
import { InventoryProvider }    from './context/InventoryContext';
import { CartProvider }         from './context/CartContext';
import { TransactionsProvider } from './context/TransactionsContext';

// Autocorrección de versiones: si Vite no puede cargar un chunk
// (Vercel borró los archivos de la versión anterior), se recarga.
window.addEventListener('vite:preloadError', () => {
  window.location.reload();
});

// ── Detección de flujo de reseteo de contraseña ───────────────────────────────
// TEMPORAL: Firebase redirige con ?mode=resetPassword&oobCode=...
// Este bloque se elimina en la Fase 1 al migrar la autenticación.
const urlParams = new URLSearchParams(window.location.search);
const urlMode   = urlParams.get('mode');
const oobCode   = urlParams.get('oobCode');
const isReset   = urlMode === 'resetPassword' && !!oobCode;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      {isReset ? (
        // Página de reseteo standalone — sin providers
        // TEMPORAL: se reemplaza en Fase 1 por el flujo de auth propio
        <ResetPasswordPage oobCode={oobCode} />
      ) : (
        // QueryClientProvider envuelve todo — los hooks de TanStack Query
        // necesitan acceso al queryClient desde cualquier punto del árbol.
        <QueryClientProvider client={queryClient}>
          {/* Los providers existentes quedan dentro de QueryClientProvider.
              En las Fases siguientes se irán migrando a useQuery/useMutation. */}
          <AuthProvider>
            <InventoryProvider>
              <TransactionsProvider>
                <CartProvider>
                  <App />
                </CartProvider>
              </TransactionsProvider>
            </InventoryProvider>
          </AuthProvider>
        </QueryClientProvider>
      )}
    </ErrorBoundary>
  </React.StrictMode>,
);
