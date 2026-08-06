import './_env.js';
/**
 * api/_google.js
 *
 * Verificación de tokens de Google Identity Services (GIS).
 * El frontend usa el botón "Sign in with Google", que devuelve un id_token (JWT)
 * firmado por Google. Este helper lo verifica server-side antes de confiar en él.
 *
 * IMPORTANTE: nunca hay que confiar en un id_token sin verificarlo — cualquiera
 * podría mandar un JWT inventado desde su navegador. verifyIdToken() valida la
 * firma contra las claves públicas de Google, que el `aud` sea nuestro Client ID,
 * y que no haya expirado.
 */
import { OAuth2Client } from 'google-auth-library';

// Reutilizamos VITE_GOOGLE_CLIENT_ID: en Vercel, las variables de entorno están
// disponibles en las funciones serverless sin importar el prefijo VITE_.
// Ese prefijo solo le importa a Vite al armar el bundle del cliente — no es
// necesario duplicar la variable con otro nombre para el backend.
const GOOGLE_CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID;

if (!GOOGLE_CLIENT_ID) {
  throw new Error('[Google Auth] La variable VITE_GOOGLE_CLIENT_ID no está definida.');
}

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

/**
 * Verifica un id_token de Google y devuelve los datos básicos del usuario.
 *
 * @param {string} idToken
 * @returns {Promise<{googleId: string, email: string, name: string, avatarUrl: string|null}>}
 * @throws {Error & {status: number}} si el token es inválido, expiró, o no es de nuestra app.
 */
export async function verifyGoogleToken(idToken) {
  if (!idToken || typeof idToken !== 'string') {
    const err = new Error('idToken es requerido.');
    err.status = 400;
    throw err;
  }

  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });
  } catch {
    const err = new Error('Token de Google inválido o expirado.');
    err.status = 401;
    throw err;
  }

  const payload = ticket.getPayload();
  if (!payload) {
    const err = new Error('Token de Google sin datos.');
    err.status = 401;
    throw err;
  }

  if (payload.email_verified === false) {
    const err = new Error('El email de Google no está verificado.');
    err.status = 401;
    throw err;
  }

  return {
    googleId:  payload.sub,
    email:     payload.email,
    name:      payload.name || payload.email,
    avatarUrl: payload.picture || null,
  };
}
