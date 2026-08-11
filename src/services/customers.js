/**
 * src/services/customers.js
 *
 * Actualizado — el backend pasó de rutas dinámicas a un solo archivo
 * (api/data.js) con `?resource=customers`.
 */
import { api } from './api.js';

export const customersService = {
  getAll: (search) => api.get(`/data?resource=customers${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  create: (body)   => api.post('/data?resource=customers', body),
  update: (id, body) => api.patch(`/data?resource=customers&id=${id}`, body),
  delete: (id)      => api.delete(`/data?resource=customers&id=${id}`),
};
