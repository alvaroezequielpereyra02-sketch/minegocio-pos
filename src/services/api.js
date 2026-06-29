/**
 * src/services/api.js
 *
 * Fetcher base para todas las llamadas a las API Routes de Vercel (/api/).
 *
 * Responsabilidades:
 * - Adjuntar el token JWT en cada request.
 * - Manejar errores HTTP de forma uniforme.
 * - Redirigir al login cuando el token expira (401).
 * - Tipar los errores para que TanStack Query los muestre correctamente.
 */

const TOKEN_KEY = 'mnpos_token';

export const tokenStorage = {
  get:   ()      => localStorage.getItem(TOKEN_KEY),
  set:   (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: ()      => localStorage.removeItem(TOKEN_KEY),
};

/**
 * Error de API con código HTTP incluido.
 * Permite a los componentes diferenciar un 404 de un 500.
 */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name   = 'ApiError';
    this.status = status;
  }
}

/**
 * Función interna que hace el fetch con headers de auth.
 */
async function apiFetch(path, options = {}) {
  const token = tokenStorage.get();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`/api${path}`, { ...options, headers });

  // Token expirado o inválido → limpiar y redirigir al login
  if (res.status === 401) {
    tokenStorage.clear();
    window.dispatchEvent(new CustomEvent('mnpos:session-expired'));
    throw new ApiError('Sesión expirada. Por favor, iniciá sesión de nuevo.', 401);
  }

  // Para respuestas sin cuerpo (204 No Content)
  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(
      data?.error || `Error del servidor (${res.status})`,
      res.status,
    );
  }

  return data;
}

/**
 * API pública con métodos tipados.
 *
 * Uso:
 *   const productos = await api.get('/products');
 *   const nuevo     = await api.post('/products', { name: 'Mate' });
 *   await api.delete('/products/123');
 */
export const api = {
  get:    (path)        => apiFetch(path, { method: 'GET' }),
  post:   (path, body)  => apiFetch(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    (path, body)  => apiFetch(path, { method: 'PUT',    body: JSON.stringify(body) }),
  patch:  (path, body)  => apiFetch(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  delete: (path)        => apiFetch(path, { method: 'DELETE' }),
};
