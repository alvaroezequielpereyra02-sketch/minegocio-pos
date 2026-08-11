/**
 * src/services/expenses.js
 *
 * Actualizado — el backend pasó de rutas dinámicas a un solo archivo
 * (api/data.js) con `?resource=expenses`.
 */
import { api } from './api.js';

export const expensesService = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams({ resource: 'expenses', ...params }).toString();
    return api.get(`/data?${qs}`);
  },
  create: (body) => api.post('/data?resource=expenses', body),
  delete: (id)   => api.delete(`/data?resource=expenses&id=${id}`),
};
