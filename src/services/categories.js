/**
 * src/services/categories.js — Fase 2A
 */
import { api } from './api.js';

export const categoriesService = {
  getAll: ()       => api.get('/categories'),
  create: (name)   => api.post('/categories', { name }),
  update: (id, name) => api.patch(`/categories/${id}`, { name }),
  delete: (id)     => api.delete(`/categories/${id}`),
};

export const subcategoriesService = {
  getAll: (categoryId) => api.get(`/subcategories${categoryId ? `?category=${categoryId}` : ''}`),
  create: (categoryId, name) => api.post('/subcategories', { categoryId, name }),
  delete: (id) => api.delete(`/subcategories/${id}`),
};
