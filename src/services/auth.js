/**
 * src/services/auth.js
 *
 * Servicio de autenticación — Fase 1.
 * Reemplaza el stub de la Fase 0 con la implementación real.
 */
import { api, tokenStorage } from './api.js';

export const authService = {
  /**
   * Login / registro automático de cliente con Google.
   * @param {string} googleIdToken — el `credential` que devuelve el botón de Google
   */
  loginWithGoogle: async (googleIdToken) => {
    const data = await api.post('/auth/google', { idToken: googleIdToken });
    tokenStorage.set(data.token);
    return data.user;
  },

  /**
   * Registro (o ascenso) de empleado/admin con código de invitación.
   */
  registerWithInvite: async ({ googleIdToken, inviteCode }) => {
    const data = await api.post('/auth/invite', { idToken: googleIdToken, inviteCode });
    tokenStorage.set(data.token);
    return data.user;
  },

  /**
   * Completa el perfil obligatorio del cliente antes de poder comprar.
   */
  completeProfile: async ({ name, businessName, address, phone }) => {
    return api.patch('/auth/me/profile', { name, businessName, address, phone });
  },

  /**
   * Perfil actual, siempre fresco desde el servidor (no del JWT).
   */
  getMe: async () => api.get('/auth/me'),

  /**
   * Desliza la sesión: token nuevo con expiración fresca y rol actualizado.
   */
  refresh: async () => {
    const data = await api.post('/auth/refresh', {});
    tokenStorage.set(data.token);
    return data;
  },

  /**
   * Cierra la sesión localmente.
   */
  logout: () => {
    tokenStorage.clear();
  },

  // ── Gestión de invitaciones (solo admin) ────────────────────────────────────
  listInvites:  ()     => api.get('/auth/invites'),
  createInvite: (body) => api.post('/auth/invites', body),
};
