/**
 * src/services/products.js
 *
 * Servicio de productos — se implementa en la Fase 2.
 */
import { api } from './api.js';

export const productsService = {
  getAll:       (params = {}) => api.get(`/products?${new URLSearchParams(params)}`),
  getById:      (id)          => api.get(`/products/${id}`),
  create:       (body)        => api.post('/products', body),
  update:       (id, body)    => api.patch(`/products/${id}`, body),
  delete:       (id)          => api.delete(`/products/${id}`),
  bulkPrice:    (body)        => api.post('/products/bulk-price-update', body),
  barcodeLookup:(barcode)     => api.get(`/products/barcode-lookup?code=${barcode}`),
  generateDesc: (body)        => api.post('/products/generate-description', body),

  // Variantes
  getVariants:   (productId)       => api.get(`/products/${productId}/variants`),
  createVariant: (productId, body) => api.post(`/products/${productId}/variants`, body),
  updateVariant: (productId, variantId, body) =>
    api.patch(`/products/${productId}/variants/${variantId}`, body),
  deleteVariant: (productId, variantId) =>
    api.delete(`/products/${productId}/variants/${variantId}`),
};
