/**
 * src/services/transactions.js — Fase 3
 */
import { api } from './api.js';

export const transactionsService = {
  getAll:    (params = {}) => api.get(`/transactions?${new URLSearchParams(params)}`),
  getById:   (id)          => api.get(`/transactions/${id}`),
  create:    (body)        => api.post('/transactions', body),
  update:    (id, body)    => api.patch(`/transactions/${id}`, body),
  delete:    (id)          => api.delete(`/transactions/${id}`),
  checkout:  (body)        => api.post('/checkout', body),

  // Cuenta corriente
  getBalance:     (clientId) => api.get(`/customers/${clientId}/balance`),
  getMovements:   (clientId) => api.get(`/customers/${clientId}/balance/movements`),
  registerPayment:(clientId, body) => api.post(`/customers/${clientId}/balance/payment`, body),
};

// =============================================================================

/**
 * src/services/customers.js — Fase 3
 */
export const customersService = {
  getAll:    (params = {}) => api.get(`/customers?${new URLSearchParams(params)}`),
  getById:   (id)          => api.get(`/customers/${id}`),
  create:    (body)        => api.post('/customers', body),
  update:    (id, body)    => api.patch(`/customers/${id}`, body),
  delete:    (id)          => api.delete(`/customers/${id}`),
};

// =============================================================================

/**
 * src/services/analytics.js — Fase 4
 */
export const analyticsService = {
  getBalance:     (params = {}) => api.get(`/analytics/balance?${new URLSearchParams(params)}`),
  getProducts:    (params = {}) => api.get(`/analytics/products?${new URLSearchParams(params)}`),
  getClients:     (params = {}) => api.get(`/analytics/clients?${new URLSearchParams(params)}`),
  getCashflow:    (params = {}) => api.get(`/analytics/cashflow?${new URLSearchParams(params)}`),
  getInventory:   ()            => api.get('/analytics/inventory'),
  getExchangeRate:()            => api.get('/exchange-rate'),
};
