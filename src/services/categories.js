/**
 * src/services/categories.js
 *
 * Actualizado — el backend pasó de rutas dinámicas a un solo archivo
 * (api/categories.js) con `?id=` y `?resource=`.
 */
import { api } from './api.js';

export const categoriesService = {
  getAll: ()          => api.get('/categories'),
  create: (name)      => api.post('/categories', { name }),
  update: (id, name)  => api.patch(`/categories?id=${id}`, { name }),
  delete: (id)        => api.delete(`/categories?id=${id}`),
};

export const subcategoriesService = {
  getAll: (categoryId) => api.get(`/categories?resource=subcategories${categoryId ? `&category=${categoryId}` : ''}`),
  create: (categoryId, name) => api.post('/categories?resource=subcategories', { categoryId, name }),
  delete: (id) => api.delete(`/categories?resource=subcategories&id=${id}`),
};
