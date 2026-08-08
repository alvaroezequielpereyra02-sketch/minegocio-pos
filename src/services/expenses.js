/**
 * src/services/expenses.js — Fase 2A
 */
import { api } from './api.js';

export const expensesService = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/expenses${qs ? `?${qs}` : ''}`);
  },
  create: (body) => api.post('/expenses', body),
  delete: (id)   => api.delete(`/expenses/${id}`),
};
