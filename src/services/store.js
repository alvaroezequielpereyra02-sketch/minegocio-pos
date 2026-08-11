/**
 * src/services/store.js
 *
 * Actualizado — el backend pasó de rutas dinámicas a un solo archivo
 * (api/data.js) con `?resource=store-profile`.
 */
import { api } from './api.js';

export const storeService = {
  getProfile:    ()     => api.get('/data?resource=store-profile'),
  updateProfile: (body) => api.patch('/data?resource=store-profile', body),
};
