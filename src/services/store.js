/**
 * src/services/store.js
 *
 * Actualizado en la consolidación de funciones (Fase 2A.1): ahora vive bajo
 * /api/data/store-profile en vez de /api/store/profile. Cambio de URL
 * únicamente.
 */
import { api } from './api.js';

export const storeService = {
  getProfile:    ()     => api.get('/data/store-profile'),
  updateProfile: (body) => api.patch('/data/store-profile', body),
};
