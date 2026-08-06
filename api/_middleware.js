import './_env.js';
/**
 * api/_middleware.js
 *
 * Middleware de autenticación para las API Routes de Vercel.
 *
 * Uso:
 *   import { requireAuth, requireAdmin } from './_middleware.js';
 *
 *   // Solo usuarios autenticados:
 *   export default requireAuth(async (req, res) => { ... });
 *
 *   // Solo admin:
 *   export default requireAdmin(async (req, res) => { ... });
 *
 *   // Acceso al usuario autenticado dentro del handler:
 *   req.user → { sub, role, store_id, email, name }
 */
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('[Auth] La variable JWT_SECRET no está definida.');
}

// ── Errores tipados ────────────────────────────────────────────────────────────

class AuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.name   = 'AuthError';
    this.status = status;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extrae y verifica el JWT del header Authorization.
 * @returns {Object} payload del token { sub, role, store_id, email, name }
 * @throws {AuthError}
 */
function verifyToken(req) {
  const authHeader = req.headers['authorization'] ?? req.headers['Authorization'] ?? '';

  if (!authHeader.startsWith('Bearer ')) {
    throw new AuthError('Token no proporcionado.');
  }

  const token = authHeader.slice(7);

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    if (e.name === 'TokenExpiredError') throw new AuthError('Token expirado.');
    throw new AuthError('Token inválido.');
  }
}

// ── HOFs (Higher Order Functions) ─────────────────────────────────────────────

/**
 * Requiere que el usuario esté autenticado (cualquier rol).
 */
export function requireAuth(handler) {
  return async (req, res) => {
    try {
      req.user = verifyToken(req);
      return await handler(req, res);
    } catch (e) {
      if (e instanceof AuthError) {
        return res.status(e.status).json({ error: e.message });
      }
      console.error('[requireAuth] Error inesperado:', e);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  };
}

/**
 * Requiere rol admin.
 */
export function requireAdmin(handler) {
  return requireAuth(async (req, res) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Acceso denegado. Se requiere rol admin.',
      });
    }
    return handler(req, res);
  });
}

/**
 * Requiere rol admin o employee.
 */
export function requireStaff(handler) {
  return requireAuth(async (req, res) => {
    if (!['admin', 'employee'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Acceso denegado. Se requiere rol admin o empleado.',
      });
    }
    return handler(req, res);
  });
}

/**
 * Genera un JWT con los datos del usuario.
 * Se llama desde /api/auth/google y /api/auth/invite.
 *
 * @param {{ id, role, store_id, email, name }} user
 * @returns {string} token JWT
 */
export function signToken(user) {
  return jwt.sign(
    {
      sub:      user.id,
      role:     user.role,
      store_id: user.store_id,
      email:    user.email,
      name:     user.name,
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  );
}
