/**
 * src/services/expenses.js
 *
 * Actualizado en la consolidación de funciones (Fase 2A.1): ahora vive bajo
 * /api/data/expenses en vez de /api/expenses. Cambio de URL únicamente.
 */
import { api } from './api.js';

export const expensesService = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/data/expenses${qs ? `?${qs}` : ''}`);
  },
  create: (body) => api.post('/data/expenses', body),
  delete: (id)   => api.delete(`/data/expenses/${id}`),
};
