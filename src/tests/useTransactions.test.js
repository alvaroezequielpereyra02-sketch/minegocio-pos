import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTransactions } from '../hooks/useTransactions';

import {
    writeBatch, getDoc, increment, doc, collection,
} from 'firebase/firestore';

// ── writeBatch mock con operaciones encadenables ───────────────────────────────
const mockBatch = {
    set:    vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    commit: vi.fn().mockResolvedValue(undefined),
};

const nowTs = () => ({ seconds: Math.floor(Date.now() / 1000) });

const mockUser     = { uid: 'admin-uid', email: 'admin@test.com' };
const mockUserData = { role: 'admin' };

const mockCart = [
    { id: 'prod-1', name: 'Coca Cola', qty: 2, price: 500, cost: 300 },
    { id: 'prod-2', name: 'Agua',      qty: 1, price: 200, cost: 100 },
];

const mockSaleData = {
    type: 'sale', total: 1200,
    clientId: 'cust-1', clientName: 'Juan', clientRole: 'customer',
    paymentStatus: 'paid', fulfillmentStatus: 'pending',
    sellerId: 'admin-uid', paymentMethod: 'cash',
    date: { _type: 'serverTimestamp' },
};

beforeEach(() => {
    vi.clearAllMocks();
    writeBatch.mockReturnValue(mockBatch);
    doc.mockReturnValue({ id: 'mocked-ref', path: 'mocked-path' });
    collection.mockReturnValue({ path: 'mocked-collection' });

    // Simular que collection/doc retorna un ref con id generado
    const mockTransRef = { id: 'tx-new-123', path: 'stores/test/transactions/tx-new-123' };
    doc.mockImplementation((db, ...args) => {
        // Si se llama con collection como primer arg, es para nueva transacción
        if (args.length === 0) return mockTransRef;
        return { id: args[args.length - 1] || 'mocked-id', path: args.join('/') };
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// createTransaction
// ─────────────────────────────────────────────────────────────────────────────

describe('useTransactions — createTransaction', () => {
    it('usa writeBatch para operación atómica', async () => {
        const { result } = renderHook(() =>
            useTransactions(mockUser, mockUserData, [], [], [], 'week')
        );

        await act(async () => {
            await result.current.createTransaction(mockSaleData, mockCart);
        });

        expect(writeBatch).toHaveBeenCalledTimes(1);
        expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });

    it('descuenta stock de cada producto del carrito', async () => {
        const { result } = renderHook(() =>
            useTransactions(mockUser, mockUserData, [], [], [], 'week')
        );

        await act(async () => {
            await result.current.createTransaction(mockSaleData, mockCart);
        });

        // Debe haber 2 updates de stock (uno por cada item del carrito)
        const updateCalls = mockBatch.update.mock.calls.filter(
            ([, payload]) => payload.stock !== undefined
        );
        expect(updateCalls).toHaveLength(2);

        // Cada stock debe ser negativo (increment con valor negativo)
        // increment está mockeado como v => v, entonces -qty
        updateCalls.forEach((call, i) => {
            expect(call[1].stock).toBe(-mockCart[i].qty);
        });
    });

    it('elimina campos undefined antes de persistir', async () => {
        const saleDataWithUndefined = { ...mockSaleData, campoExtra: undefined };
        const { result } = renderHook(() =>
            useTransactions(mockUser, mockUserData, [], [], [], 'week')
        );

        await act(async () => {
            await result.current.createTransaction(saleDataWithUndefined, mockCart);
        });

        const setCall = mockBatch.set.mock.calls[0];
        expect(setCall[1].campoExtra).toBeUndefined();
        // El campo no debe estar presente en el objeto limpio
        expect(Object.keys(setCall[1])).not.toContain('campoExtra');
    });

    it('actualiza el contador de compras del cliente con merge', async () => {
        const { result } = renderHook(() =>
            useTransactions(mockUser, mockUserData, [], [], [], 'week')
        );

        await act(async () => {
            await result.current.createTransaction(mockSaleData, mockCart);
        });

        // El set con merge:true para el cliente
        const setMergeCall = mockBatch.set.mock.calls.find(
            call => call[2]?.merge === true
        );
        expect(setMergeCall).toBeDefined();
        expect(setMergeCall[1].externalOrdersCount).toBeDefined();
    });

    it('no crea documento de cliente para ventas anónimas', async () => {
        const anonSaleData = { ...mockSaleData, clientId: 'anonimo', clientRole: 'guest' };
        const { result } = renderHook(() =>
            useTransactions(mockUser, mockUserData, [], [], [], 'week')
        );

        await act(async () => {
            await result.current.createTransaction(anonSaleData, mockCart);
        });

        const setMergeCall = mockBatch.set.mock.calls.find(
            call => call[2]?.merge === true
        );
        expect(setMergeCall).toBeUndefined();
    });

    it('retorna la transacción con su id generado', async () => {
        const { result } = renderHook(() =>
            useTransactions(mockUser, mockUserData, [], [], [], 'week')
        );

        let tx;
        await act(async () => {
            tx = await result.current.createTransaction(mockSaleData, mockCart);
        });

        expect(tx).toBeDefined();
        expect(tx.id).toBeDefined();
        expect(tx.type).toBe('sale');
        expect(tx.total).toBe(1200);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateTransaction — ajuste de stock inteligente
// ─────────────────────────────────────────────────────────────────────────────

describe('useTransactions — updateTransaction', () => {
    const oldItems = [{ id: 'prod-1', qty: 2 }];
    const newItems = [{ id: 'prod-1', qty: 5 }];

    beforeEach(() => {
        getDoc.mockResolvedValue({
            exists: () => true,
            data:   () => ({ items: oldItems, total: 1000, type: 'sale' }),
        });
    });

    it('actualiza solo campos simples sin toccar el stock', async () => {
        const { result } = renderHook(() =>
            useTransactions(mockUser, mockUserData, [], [], [], 'week')
        );

        await act(async () => {
            await result.current.updateTransaction('tx-1', { paymentStatus: 'paid' });
        });

        // Sin items → no usa writeBatch, solo updateDoc
        expect(writeBatch).not.toHaveBeenCalled();
    });

    it('usa writeBatch cuando se actualizan los items', async () => {
        const { result } = renderHook(() =>
            useTransactions(mockUser, mockUserData, [], [], [], 'week')
        );

        await act(async () => {
            await result.current.updateTransaction('tx-1', { items: newItems, total: 2500 });
        });

        expect(writeBatch).toHaveBeenCalledTimes(1);
        expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });

    it('devuelve el stock de los items viejos antes de aplicar los nuevos', async () => {
        const { result } = renderHook(() =>
            useTransactions(mockUser, mockUserData, [], [], [], 'week')
        );

        await act(async () => {
            await result.current.updateTransaction('tx-1', { items: newItems, total: 2500 });
        });

        const stockUpdates = mockBatch.update.mock.calls.filter(
            ([, payload]) => payload.stock !== undefined
        );

        // Debe haber 2 updates de stock: +oldQty (devolución) y -newQty (nuevo desembolso)
        expect(stockUpdates.length).toBeGreaterThanOrEqual(2);

        const stocks = stockUpdates.map(c => c[1].stock);
        expect(stocks).toContain(oldItems[0].qty);  // devolver lo viejo (+2)
        expect(stocks).toContain(-newItems[0].qty); // descontar lo nuevo (-5)
    });

    it('bloquea la actualización si los nuevos items están vacíos y total=0', async () => {
        const { result } = renderHook(() =>
            useTransactions(mockUser, mockUserData, [], [], [], 'week')
        );

        await act(async () => {
            await result.current.updateTransaction('tx-1', { items: [], total: 0 });
        });

        // El "escudo de seguridad" debe haberlo bloqueado
        expect(writeBatch).not.toHaveBeenCalled();
    });

    it('lanza error si la transacción no existe', async () => {
        getDoc.mockResolvedValueOnce({ exists: () => false, data: () => null });
        const { result } = renderHook(() =>
            useTransactions(mockUser, mockUserData, [], [], [], 'week')
        );

        await expect(
            act(async () => {
                await result.current.updateTransaction('tx-inexistente', { items: newItems, total: 100 });
            })
        ).rejects.toThrow();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// deleteTransaction — restauración de stock
// ─────────────────────────────────────────────────────────────────────────────

describe('useTransactions — deleteTransaction', () => {
    const transactionItems = [
        { id: 'prod-1', qty: 3 },
        { id: 'prod-2', qty: 1 },
    ];

    beforeEach(() => {
        getDoc.mockResolvedValue({
            exists: () => true,
            data:   () => ({ type: 'sale', items: transactionItems }),
        });
    });

    it('usa writeBatch para borrar + restaurar stock', async () => {
        const { result } = renderHook(() =>
            useTransactions(mockUser, mockUserData, [], [], [], 'week')
        );

        await act(async () => { await result.current.deleteTransaction('tx-1'); });

        expect(writeBatch).toHaveBeenCalledTimes(1);
        expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });

    it('restaura el stock de todos los productos vendidos', async () => {
        const { result } = renderHook(() =>
            useTransactions(mockUser, mockUserData, [], [], [], 'week')
        );

        await act(async () => { await result.current.deleteTransaction('tx-1'); });

        const stockUpdates = mockBatch.update.mock.calls.filter(
            ([, payload]) => payload.stock !== undefined
        );

        expect(stockUpdates).toHaveLength(2);
        // Los stocks deben ser positivos (devolución al inventario)
        expect(stockUpdates[0][1].stock).toBe(transactionItems[0].qty); // +3
        expect(stockUpdates[1][1].stock).toBe(transactionItems[1].qty); // +1
    });

    it('borra el documento de la transacción', async () => {
        const { result } = renderHook(() =>
            useTransactions(mockUser, mockUserData, [], [], [], 'week')
        );

        await act(async () => { await result.current.deleteTransaction('tx-1'); });

        expect(mockBatch.delete).toHaveBeenCalledTimes(1);
    });

    it('no hace nada si la transacción no existe', async () => {
        getDoc.mockResolvedValueOnce({ exists: () => false });
        const { result } = renderHook(() =>
            useTransactions(mockUser, mockUserData, [], [], [], 'week')
        );

        await act(async () => { await result.current.deleteTransaction('tx-inexistente'); });

        expect(writeBatch).not.toHaveBeenCalled();
    });

    it('no restaura stock en transacciones que no son de tipo sale', async () => {
        getDoc.mockResolvedValueOnce({
            exists: () => true,
            data:   () => ({ type: 'expense', items: [] }),
        });
        const { result } = renderHook(() =>
            useTransactions(mockUser, mockUserData, [], [], [], 'week')
        );

        await act(async () => { await result.current.deleteTransaction('tx-expense'); });

        const stockUpdates = mockBatch.update.mock.calls.filter(
            ([, payload]) => payload.stock !== undefined
        );
        expect(stockUpdates).toHaveLength(0);
        // Pero sí debe borrar el documento
        expect(mockBatch.delete).toHaveBeenCalledTimes(1);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// purgeTransactions
// ─────────────────────────────────────────────────────────────────────────────

describe('useTransactions — purgeTransactions', () => {
    it('no hace nada si no hay transacciones cargadas', async () => {
        const { result } = renderHook(() =>
            useTransactions(mockUser, mockUserData, [], [], [], 'week')
        );

        await act(async () => { await result.current.purgeTransactions(); });

        expect(writeBatch).not.toHaveBeenCalled();
    });
});
