/**
 * src/services/auth.js
 *
 * Actualizado — el backend pasó de rutas dinámicas (/api/auth/google) a
 * un solo archivo con `?action=` (/api/auth?action=google), porque el
 * patrón de rutas dinámicas no se estaba reconociendo de forma confiable
 * en este proyecto. Mismo comportamiento, URLs distintas.
 */
import { api, tokenStorage } from './api.js';

export const authService = {
  loginWithGoogle: async (googleIdToken) => {
    const data = await api.post('/auth?action=google', { idToken: googleIdToken });
    tokenStorage.set(data.token);
    return data.user;
  },

  registerWithInvite: async ({ googleIdToken, inviteCode }) => {
    const data = await api.post('/auth?action=invite', { idToken: googleIdToken, inviteCode });
    tokenStorage.set(data.token);
    return data.user;
  },

  completeProfile: async ({ name, businessName, address, phone }) => {
    return api.patch('/auth?action=me-profile', { name, businessName, address, phone });
  },

  getMe: async () => api.get('/auth?action=me'),

  refresh: async () => {
    const data = await api.post('/auth?action=refresh', {});
    tokenStorage.set(data.token);
    return data;
  },

  logout: () => {
    tokenStorage.clear();
  },

  listInvites:  ()     => api.get('/auth?action=invites'),
  createInvite: (body) => api.post('/auth?action=invites', body),
};
