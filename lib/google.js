/**
 * lib/google.js
 *
 * Verificación de tokens de Google Identity Services (GIS).
 */
import './env.js';
import { OAuth2Client } from 'google-auth-library';

const GOOGLE_CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID;

if (!GOOGLE_CLIENT_ID) {
  throw new Error('[Google Auth] La variable VITE_GOOGLE_CLIENT_ID no está definida.');
}

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

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
