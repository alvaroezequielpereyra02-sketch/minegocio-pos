/**
 * src/services/products.js
 *
 * Actualizado — el backend pasó de rutas dinámicas a un solo archivo
 * (api/products.js) con `?id=` y `?action=`. Mismas funciones, mismas
 * firmas, URLs distintas por dentro.
 */
import { api } from './api.js';

export const productsService = {
  getAll: (params = {}) => {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''));
    const qs = new URLSearchParams(clean).toString();
    return api.get(`/products${qs ? `?${qs}` : ''}`);
  },
  getById: (id)       => api.get(`/products?id=${id}`),
  create:  (body)     => api.post('/products', body),
  update:  (id, body) => api.patch(`/products?id=${id}`, body),
  delete:  (id)       => api.delete(`/products?id=${id}`),

  addStock:      (id, qty)        => api.post(`/products?id=${id}&action=add-stock`, { qty }),
  registerFaulty:(id, qty, reason) => api.post(`/products?id=${id}&action=register-faulty`, { qty, reason }),
  bulkPrice:     (categoryId, priceConfig) => api.post('/products?action=bulk-price-update', { categoryId, ...priceConfig }),

  barcodeLookup: (barcode) => api.get(`/products/barcode-lookup?code=${barcode}`),
  generateDesc:  (body)    => api.post('/products/generate-description', body),
};
