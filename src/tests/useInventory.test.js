import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';

import { useInventory } from '../hooks/useInventory';
import { api } from '../services/api';

// api.js ya está mockeado globalmente en tests/setup.js (Fase 0).
// Acá controlamos qué devuelve cada llamada en cada caso.

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false, staleTime: 0 } },
  });
  return function Wrapper({ children }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

const fakeUser = { uid: 'u1' };
const adminData  = { role: 'admin' };
const clientData = { role: 'client' };

describe('useInventory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Por defecto, cualquier GET devuelve lista vacía — cada test pisa lo que necesita.
    api.get.mockResolvedValue([]);
  });

  describe('queries', () => {
    it('products arranca en [] y se llena con lo que devuelve el servicio', async () => {
      api.get.mockImplementation((path) => {
        if (path.startsWith('/products')) {
          return Promise.resolve([{ id: 'p1', name: 'Mate', price: 100, stock: 5, images: [] }]);
        }
        return Promise.resolve([]);
      });

      const { result } = renderHook(() => useInventory(fakeUser, adminData), { wrapper: createWrapper() });

      expect(result.current.products).toEqual([]); // estado inicial, antes de que resuelva

      await waitFor(() => expect(result.current.products).toHaveLength(1));
      expect(result.current.products[0].name).toBe('Mate');
    });

    it('storeProfile tiene un valor por defecto mientras carga', () => {
      const { result } = renderHook(() => useInventory(fakeUser, adminData), { wrapper: createWrapper() });
      expect(result.current.storeProfile).toEqual({ name: 'MiNegocio', logoUrl: '' });
    });

    it('customers y expenses NO se piden si el usuario no es admin', async () => {
      renderHook(() => useInventory(fakeUser, clientData), { wrapper: createWrapper() });

      // Deja pasar un tick por si algo dispara de más — envuelto en act()
      // porque las queries habilitadas (products, categories, etc.) sí
      // actualizan estado en este lapso, aunque no sean las que estamos probando.
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      const calledPaths = api.get.mock.calls.map(([path]) => path);
      expect(calledPaths.some((p) => p.startsWith('/data?resource=customers'))).toBe(false);
      expect(calledPaths.some((p) => p.startsWith('/data?resource=expenses'))).toBe(false);
    });

    it('customers y expenses SÍ se piden si el usuario es admin', async () => {
      renderHook(() => useInventory(fakeUser, adminData), { wrapper: createWrapper() });

      await waitFor(() => {
        const calledPaths = api.get.mock.calls.map(([path]) => path);
        expect(calledPaths.some((p) => p.startsWith('/data?resource=customers'))).toBe(true);
        expect(calledPaths.some((p) => p.startsWith('/data?resource=expenses'))).toBe(true);
      });
    });

    it('nada se pide si no hay usuario', async () => {
      renderHook(() => useInventory(null, null), { wrapper: createWrapper() });
      await new Promise((r) => setTimeout(r, 50));
      expect(api.get).not.toHaveBeenCalled();
    });
  });

  describe('mutaciones de productos', () => {
    it('addProduct llama a POST /products con los datos', async () => {
      api.post.mockResolvedValue({ id: 'new', name: 'Yerba' });
      const { result } = renderHook(() => useInventory(fakeUser, adminData), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.addProduct({ name: 'Yerba', price: 500 });
      });

      expect(api.post).toHaveBeenCalledWith('/products', { name: 'Yerba', price: 500 });
    });

    it('addStock(product, qty) llama al endpoint con product.id, no con el objeto completo', async () => {
      api.post.mockResolvedValue({ id: 'p1', stock: 15 });
      const { result } = renderHook(() => useInventory(fakeUser, adminData), { wrapper: createWrapper() });

      const product = { id: 'p1', name: 'Mate', stock: 10 };
      await act(async () => {
        await result.current.addStock(product, 5);
      });

      expect(api.post).toHaveBeenCalledWith('/products?id=p1&action=add-stock', { qty: 5 });
    });

    it('registerFaultyProduct(product, qty, reason) llama al endpoint correcto', async () => {
      api.post.mockResolvedValue({ id: 'p1', stock: 8 });
      const { result } = renderHook(() => useInventory(fakeUser, adminData), { wrapper: createWrapper() });

      const product = { id: 'p1', name: 'Mate' };
      await act(async () => {
        await result.current.registerFaultyProduct(product, 2, 'Se rompió en el transporte');
      });

      expect(api.post).toHaveBeenCalledWith('/products?id=p1&action=register-faulty', {
        qty: 2, reason: 'Se rompió en el transporte',
      });
    });

    it('bulkUpdatePrices(categoryId, priceConfig) aplana el payload como espera el backend', async () => {
      api.post.mockResolvedValue({ updated: 12 });
      const { result } = renderHook(() => useInventory(fakeUser, adminData), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.bulkUpdatePrices('__all__', { type: 'percent', value: 10, field: 'price', roundTo: 10 });
      });

      expect(api.post).toHaveBeenCalledWith('/products?action=bulk-price-update', {
        categoryId: '__all__', type: 'percent', value: 10, field: 'price', roundTo: 10,
      });
    });

    it('deleteProduct propaga el error si el backend lo rechaza', async () => {
      const { ApiError } = await import('../services/api');
      api.delete.mockRejectedValue(new ApiError('Solo un admin puede eliminar productos.', 403));

      const { result } = renderHook(() => useInventory(fakeUser, adminData), { wrapper: createWrapper() });

      await expect(result.current.deleteProduct('p1')).rejects.toThrow('Solo un admin puede eliminar productos.');
    });
  });

  describe('categorías', () => {
    it('deleteCategory propaga el mensaje cuando hay productos asociados (409)', async () => {
      const { ApiError } = await import('../services/api');
      api.delete.mockRejectedValue(new ApiError('No se puede borrar: 3 producto(s) usan esta categoría.', 409));

      const { result } = renderHook(() => useInventory(fakeUser, adminData), { wrapper: createWrapper() });

      await expect(result.current.deleteCategory('cat1'))
        .rejects.toThrow('No se puede borrar: 3 producto(s) usan esta categoría.');
    });

    it('addSubCategory(parentId, name) llama a POST /categories?resource=subcategories con ambos', async () => {
      api.post.mockResolvedValue({ id: 'sub1', name: 'Cereales dulces' });
      const { result } = renderHook(() => useInventory(fakeUser, adminData), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.addSubCategory('cat1', 'Cereales dulces');
      });

      expect(api.post).toHaveBeenCalledWith('/categories?resource=subcategories', { categoryId: 'cat1', name: 'Cereales dulces' });
    });
  });

  describe('clientes y gastos', () => {
    it('addCustomer llama a POST /data?resource=customers', async () => {
      api.post.mockResolvedValue({ id: 'c1', name: 'Kiosco Don José' });
      const { result } = renderHook(() => useInventory(fakeUser, adminData), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.addCustomer({ name: 'Kiosco Don José', phone: '11111111' });
      });

      expect(api.post).toHaveBeenCalledWith('/data?resource=customers', { name: 'Kiosco Don José', phone: '11111111' });
    });

    it('addExpense llama a POST /data?resource=expenses', async () => {
      api.post.mockResolvedValue({ id: 'e1', amount: 500 });
      const { result } = renderHook(() => useInventory(fakeUser, adminData), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.addExpense({ amount: 500, description: 'Flete' });
      });

      expect(api.post).toHaveBeenCalledWith('/data?resource=expenses', { amount: 500, description: 'Flete' });
    });
  });

  describe('perfil de tienda', () => {
    it('updateStoreProfile llama a PATCH /data?resource=store-profile', async () => {
      api.patch.mockResolvedValue({ name: 'Distribuidora P&P', logoUrl: 'https://...' });
      const { result } = renderHook(() => useInventory(fakeUser, adminData), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.updateStoreProfile({ name: 'Distribuidora P&P' });
      });

      expect(api.patch).toHaveBeenCalledWith('/data?resource=store-profile', { name: 'Distribuidora P&P' });
    });
  });
});
