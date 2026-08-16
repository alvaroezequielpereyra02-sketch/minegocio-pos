/**
 * src/services/transactions.js — Fase 3A
 */
import { api } from './api.js';

export const transactionsService = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/transactions${qs ? `?${qs}` : ''}`);
  },
  create: (body)     => api.post('/transactions', body),
  update: (id, body) => api.patch(`/transactions?id=${id}`, body),
  delete: (id)       => api.delete(`/transactions?id=${id}`),
};
