/**
 * src/services/auth.js
 *
 * Servicio de autenticación — se implementa en la Fase 1.
 * Por ahora los stubs están definidos con sus firmas finales
 * para que los componentes y hooks puedan importar desde acá
 * sin cambiar las importaciones cuando se implemente.
 */
import { api, tokenStorage } from './api.js';

export const authService = {
  /**
   * Login con Google.
   * El frontend obtiene el id_token del OAuth de Google y lo manda al backend,
   * que lo verifica con Supabase Auth y emite un JWT propio.
   *
   * @param {string} googleIdToken — id_token devuelto por el SDK de Google
   * @returns {{ user, token }}
   *
   * IMPLEMENTAR en Fase 1: POST /api/auth/google
   */
  loginWithGoogle: async (googleIdToken) => {
    const data = await api.post('/auth/google', { idToken: googleIdToken });
    tokenStorage.set(data.token);
    return data.user;
  },

  /**
   * Registro de empleado con código de invitación generado por el admin.
   *
   * IMPLEMENTAR en Fase 1: POST /api/auth/invite
   */
  registerWithInvite: async ({ googleIdToken, inviteCode, name, businessName, address, phone }) => {
    const data = await api.post('/auth/invite', {
      idToken: googleIdToken,
      inviteCode,
      name,
      businessName,
      address,
      phone,
    });
    tokenStorage.set(data.token);
    return data.user;
  },

  /**
   * Completar perfil obligatorio en el primer login de un cliente.
   * Se llama si user.profile_complete === false.
   *
   * IMPLEMENTAR en Fase 1: PATCH /api/auth/me/profile
   */
  completeProfile: async ({ name, businessName, address, phone }) => {
    return api.patch('/auth/me/profile', { name, businessName, address, phone });
  },

  /**
   * Retorna el perfil del usuario autenticado.
   *
   * IMPLEMENTAR en Fase 1: GET /api/auth/me
   */
  getMe: async () => api.get('/auth/me'),

  /**
   * Renueva el access token usando el refresh token en httpOnly cookie.
   *
   * IMPLEMENTAR en Fase 1: POST /api/auth/refresh
   */
  refresh: async () => {
    const data = await api.post('/auth/refresh', {});
    tokenStorage.set(data.token);
    return data;
  },

  /**
   * Cierra la sesión y limpia el token local.
   */
  logout: () => {
    tokenStorage.clear();
  },
};
