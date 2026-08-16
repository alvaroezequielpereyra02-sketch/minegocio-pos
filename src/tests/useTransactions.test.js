/**
 * src/tests/useTransactions.test.js — Fase 3A
 *
 * Reescrito: el hook ya no habla con Firestore (writeBatch/getDoc), habla
 * con transactionsService (→ api.js, ya mockeado globalmente en setup.js).
 * Mismo patrón que useInventory.test.js: wrapper de QueryClientProvider +
 * controlar qué devuelve cada verbo de `api`.
 *
 * calcBalance NO se prueba acá — tiene su propia suite en balance.test.js,
 * sin renderizar el hook.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';

import { useTransactions } from '../hooks/useTransactions';
import { api } from '../services/api';

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, refetchInterval: false, staleTime: 0 } },
    });
    return function Wrapper({ children }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };
}

const mockUser     = { uid: 'admin-uid', email: 'admin@test.com' };
const mockUserData = { role: 'admin' };

const mockProducts = [
    { id: 'prod-1', name: 'Coca Cola', categoryId: 'cat-bebidas' },
    { id: 'prod-2', name: 'Agua',      categoryId: 'cat-bebidas' },
];

const mockCartItems = [
    { id: 'prod-1', name: 'Coca Cola', qty: 2, price: 500, originalPrice: 500, cost: 300, offerId: null, isWholesale: false },
    { id: 'prod-2', name: 'Agua',      qty: 1, price: 200, originalPrice: 200, cost: 100, offerId: null, isWholesale: false },
];

const baseSaleData = {
    total: 1200, paymentMethod: 'cash', deliveryType: 'delivery',
    clientRole: 'guest', clientId: 'anonimo', notes: null,
};

beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue([]);
});

// ─────────────────────────────────────────────────────────────────────────────
// Carga de transacciones
// ─────────────────────────────────────────────────────────────────────────────

describe('useTransactions — carga', () => {
    it('pide /transactions cuando hay user y userData', async () => {
        renderHook(() => useTransactions(mockUser, mockUserData), { wrapper: createWrapper() });
        await waitFor(() => expect(api.get).toHaveBeenCalledWith('/transactions'));
    });

    it('no pide nada si falta el usuario', async () => {
        renderHook(() => useTransactions(null, null), { wrapper: createWrapper() });
        await act(async () => { await new Promise(r => setTimeout(r, 20)); });
        expect(api.get).not.toHaveBeenCalled();
    });

    it('arranca en array vacío mientras la query está en vuelo', () => {
        api.get.mockReturnValue(new Promise(() => {})); // nunca resuelve
        const { result } = renderHook(() => useTransactions(mockUser, mockUserData), { wrapper: createWrapper() });
        expect(result.current.transactions).toEqual([]);
    });

    it('se llena con lo que devuelve el servicio', async () => {
        api.get.mockResolvedValue([{ id: 'tx-1', type: 'sale', total: 500 }]);
        const { result } = renderHook(() => useTransactions(mockUser, mockUserData), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.transactions).toHaveLength(1));
        expect(result.current.transactions[0].id).toBe('tx-1');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// createTransaction (checkout)
// ─────────────────────────────────────────────────────────────────────────────

describe('useTransactions — createTransaction', () => {
    beforeEach(() => {
        api.post.mockResolvedValue({ id: 'tx-new-123', type: 'sale', total: 1200 });
    });

    it('llama a POST /transactions con total, método de pago y tipo de entrega', async () => {
        const { result } = renderHook(
            () => useTransactions(mockUser, mockUserData, mockProducts, [], [], 'week'),
            { wrapper: createWrapper() }
        );

        await act(async () => {
            await result.current.createTransaction(baseSaleData, mockCartItems);
        });

        expect(api.post).toHaveBeenCalledTimes(1);
        const [path, body] = api.post.mock.calls[0];
        expect(path).toBe('/transactions');
        expect(body.total).toBe(1200);
        expect(body.paymentMethod).toBe('cash');
        expect(body.deliveryType).toBe('delivery');
    });

    it('mapea cada item del carrito con productId y categoryId resuelto desde products', async () => {
        const { result } = renderHook(
            () => useTransactions(mockUser, mockUserData, mockProducts, [], [], 'week'),
            { wrapper: createWrapper() }
        );

        await act(async () => {
            await result.current.createTransaction(baseSaleData, mockCartItems);
        });

        const [, body] = api.post.mock.calls[0];
        expect(body.items).toHaveLength(2);
        expect(body.items[0]).toMatchObject({
            productId: 'prod-1', name: 'Coca Cola', qty: 2, price: 500, cost: 300, categoryId: 'cat-bebidas',
        });
        expect(body.items[1]).toMatchObject({ productId: 'prod-2', categoryId: 'cat-bebidas' });
    });

    it('incluye customerId cuando la venta es de un cliente de la libreta (clientRole=customer)', async () => {
        const { result } = renderHook(
            () => useTransactions(mockUser, mockUserData, mockProducts, [], [], 'week'),
            { wrapper: createWrapper() }
        );

        await act(async () => {
            await result.current.createTransaction(
                { ...baseSaleData, clientRole: 'customer', clientId: 'cust-1' },
                mockCartItems
            );
        });

        const [, body] = api.post.mock.calls[0];
        expect(body.customerId).toBe('cust-1');
    });

    it('NO incluye customerId para ventas anónimas o de cliente logueado', async () => {
        const { result } = renderHook(
            () => useTransactions(mockUser, mockUserData, mockProducts, [], [], 'week'),
            { wrapper: createWrapper() }
        );

        await act(async () => {
            await result.current.createTransaction({ ...baseSaleData, clientRole: 'client', clientId: 'user-1' }, mockCartItems);
        });

        const [, body] = api.post.mock.calls[0];
        expect(body.customerId).toBeUndefined();
    });

    it('retorna la transacción creada por el backend', async () => {
        const { result } = renderHook(
            () => useTransactions(mockUser, mockUserData, mockProducts, [], [], 'week'),
            { wrapper: createWrapper() }
        );

        let tx;
        await act(async () => {
            tx = await result.current.createTransaction(baseSaleData, mockCartItems);
        });

        expect(tx).toEqual({ id: 'tx-new-123', type: 'sale', total: 1200 });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateTransaction
// ─────────────────────────────────────────────────────────────────────────────

describe('useTransactions — updateTransaction', () => {
    beforeEach(() => {
        api.patch.mockResolvedValue({ id: 'tx-1', total: 2500 });
    });

    it('llama a PATCH /transactions?id=xxx con los campos limpios', async () => {
        const { result } = renderHook(
            () => useTransactions(mockUser, mockUserData, mockProducts, [], [], 'week'),
            { wrapper: createWrapper() }
        );

        await act(async () => {
            await result.current.updateTransaction('tx-1', { paymentStatus: 'paid' });
        });

        expect(api.patch).toHaveBeenCalledWith('/transactions?id=tx-1', { paymentStatus: 'paid' });
    });

    it('elimina campos undefined antes de mandar el payload', async () => {
        const { result } = renderHook(
            () => useTransactions(mockUser, mockUserData, mockProducts, [], [], 'week'),
            { wrapper: createWrapper() }
        );

        await act(async () => {
            await result.current.updateTransaction('tx-1', { paymentStatus: 'paid', notes: undefined });
        });

        const [, body] = api.patch.mock.calls[0];
        expect(Object.keys(body)).not.toContain('notes');
    });

    it('mapea los items con productId y categoryId (con fallback a products) cuando vienen en el update', async () => {
        const { result } = renderHook(
            () => useTransactions(mockUser, mockUserData, mockProducts, [], [], 'week'),
            { wrapper: createWrapper() }
        );

        const newItems = [{ id: 'prod-1', name: 'Coca Cola', qty: 5, price: 500, cost: 300 }];

        await act(async () => {
            await result.current.updateTransaction('tx-1', { items: newItems, total: 2500 });
        });

        const [, body] = api.patch.mock.calls[0];
        expect(body.items[0]).toMatchObject({ productId: 'prod-1', qty: 5, categoryId: 'cat-bebidas' });
    });

    it('respeta el categoryId del item si ya viene resuelto, sin pisarlo con products', async () => {
        const { result } = renderHook(
            () => useTransactions(mockUser, mockUserData, mockProducts, [], [], 'week'),
            { wrapper: createWrapper() }
        );

        const newItems = [{ id: 'prod-1', name: 'Coca Cola', qty: 5, price: 500, cost: 300, categoryId: 'cat-otra' }];

        await act(async () => {
            await result.current.updateTransaction('tx-1', { items: newItems, total: 2500 });
        });

        const [, body] = api.patch.mock.calls[0];
        expect(body.items[0].categoryId).toBe('cat-otra');
    });

    it('bloquea la actualización si los items quedan vacíos y el total es 0', async () => {
        const { result } = renderHook(
            () => useTransactions(mockUser, mockUserData, mockProducts, [], [], 'week'),
            { wrapper: createWrapper() }
        );

        await act(async () => {
            await result.current.updateTransaction('tx-1', { items: [], total: 0 });
        });

        expect(api.patch).not.toHaveBeenCalled();
    });

    it('NO bloquea si los items quedan vacíos pero el total es mayor a 0', async () => {
        const { result } = renderHook(
            () => useTransactions(mockUser, mockUserData, mockProducts, [], [], 'week'),
            { wrapper: createWrapper() }
        );

        await act(async () => {
            await result.current.updateTransaction('tx-1', { items: [], total: 500 });
        });

        expect(api.patch).toHaveBeenCalled();
    });

    it('retorna el resultado del backend', async () => {
        const { result } = renderHook(
            () => useTransactions(mockUser, mockUserData, mockProducts, [], [], 'week'),
            { wrapper: createWrapper() }
        );

        let res;
        await act(async () => {
            res = await result.current.updateTransaction('tx-1', { paymentStatus: 'paid' });
        });

        expect(res).toEqual({ id: 'tx-1', total: 2500 });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// deleteTransaction
// ─────────────────────────────────────────────────────────────────────────────

describe('useTransactions — deleteTransaction', () => {
    it('llama a DELETE /transactions?id=xxx', async () => {
        api.delete.mockResolvedValue(null);
        const { result } = renderHook(
            () => useTransactions(mockUser, mockUserData, mockProducts, [], [], 'week'),
            { wrapper: createWrapper() }
        );

        await act(async () => { await result.current.deleteTransaction('tx-1'); });

        expect(api.delete).toHaveBeenCalledWith('/transactions?id=tx-1');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// purgeTransactions — todavía no migrado a propósito (ver FASE_3A_CHECKLIST.md)
// ─────────────────────────────────────────────────────────────────────────────

describe('useTransactions — purgeTransactions', () => {
    it('lanza un error explicativo en vez de tocar datos', async () => {
        const { result } = renderHook(
            () => useTransactions(mockUser, mockUserData, mockProducts, [], [], 'week'),
            { wrapper: createWrapper() }
        );

        await expect(result.current.purgeTransactions()).rejects.toThrow();
        expect(api.delete).not.toHaveBeenCalled();
    });
});
