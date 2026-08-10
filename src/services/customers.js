/**
 * src/services/customers.js
 *
 * Actualizado en la consolidación de funciones (Fase 2A.1): ahora vive bajo
 * /api/data/customers en vez de /api/customers. Cambio de URL únicamente.
 */
import { api } from './api.js';

export const customersService = {
  getAll: (search) => api.get(`/data/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  create: (body)   => api.post('/data/customers', body),
  update: (id, body) => api.patch(`/data/customers/${id}`, body),
  delete: (id)      => api.delete(`/data/customers/${id}`),
};
