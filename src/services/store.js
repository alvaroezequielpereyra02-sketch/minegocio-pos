/**
 * src/services/store.js — Fase 2A
 */
import { api } from './api.js';

export const storeService = {
  getProfile:    ()     => api.get('/store/profile'),
  updateProfile: (body) => api.patch('/store/profile', body),
};
