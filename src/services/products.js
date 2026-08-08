/**
 * src/services/products.js — Fase 2A
 */
import { api } from './api.js';

export const productsService = {
  getAll: (params = {}) => {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''));
    const qs = new URLSearchParams(clean).toString();
    return api.get(`/products${qs ? `?${qs}` : ''}`);
  },
  getById: (id)       => api.get(`/products/${id}`),
  create:  (body)     => api.post('/products', body),
  update:  (id, body) => api.patch(`/products/${id}`, body),
  delete:  (id)       => api.delete(`/products/${id}`),

  addStock:      (id, qty)                => api.post(`/products/${id}/add-stock`, { qty }),
  registerFaulty:(id, qty, reason)        => api.post(`/products/${id}/register-faulty`, { qty, reason }),
  bulkPrice:     (categoryId, priceConfig) => api.post('/products/bulk-price-update', { categoryId, ...priceConfig }),

  // Se implementan en Fase 2D
  barcodeLookup: (barcode) => api.get(`/products/barcode-lookup?code=${barcode}`),
  generateDesc:  (body)    => api.post('/products/generate-description', body),
};
