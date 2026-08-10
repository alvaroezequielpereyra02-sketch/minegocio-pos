/**
 * src/services/categories.js
 *
 * Actualizado en la consolidación de funciones (Fase 2A.1): las
 * subcategorías ahora viven bajo /api/categories/subcategories en vez de
 * /api/subcategories — es un cambio de URL únicamente, la firma de estas
 * funciones no cambió, así que useInventory.js no necesita tocarse.
 */
import { api } from './api.js';

export const categoriesService = {
  getAll: ()          => api.get('/categories'),
  create: (name)      => api.post('/categories', { name }),
  update: (id, name)  => api.patch(`/categories/${id}`, { name }),
  delete: (id)        => api.delete(`/categories/${id}`),
};

export const subcategoriesService = {
  getAll: (categoryId) => api.get(`/categories/subcategories${categoryId ? `?category=${categoryId}` : ''}`),
  create: (categoryId, name) => api.post('/categories/subcategories', { categoryId, name }),
  delete: (id) => api.delete(`/categories/subcategories/${id}`),
};
