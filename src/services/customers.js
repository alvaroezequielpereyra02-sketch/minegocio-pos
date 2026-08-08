/**
 * src/services/customers.js — Fase 2A
 */
import { api } from './api.js';

export const customersService = {
  getAll: (search) => api.get(`/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  create: (body)   => api.post('/customers', body),
  update: (id, body) => api.patch(`/customers/${id}`, body),
  delete: (id)      => api.delete(`/customers/${id}`),
};
