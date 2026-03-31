import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInventory } from '../hooks/useInventory';

// ── Re-importamos los mocks para poder inspeccionarlos ────────────────────────
import {
    addDoc, updateDoc, deleteDoc, writeBatch, increment, doc, collection,
} from 'firebase/firestore';

// writeBatch mock con operaciones encadenables
const mockBatch = {
    set:    vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    commit: vi.fn().mockResolvedValue(undefined),
};

beforeEach(() => {
    vi.clearAllMocks();
    writeBatch.mockReturnValue(mockBatch);
    addDoc.mockResolvedValue({ id: 'nuevo-id-generado' });
    updateDoc.mockResolvedValue(undefined);
    deleteDoc.mockResolvedValue(undefined);
    doc.mockReturnValue({ path: 'mocked-ref' });
    collection.mockReturnValue({ path: 'mocked-collection' });
});

// ── Fixture mínima para renderizar el hook ────────────────────────────────────
const mockUser     = { uid: 'user-admin' };
const mockUserData = { role: 'admin' };

// ─────────────────────────────────────────────────────────────────────────────
// addProduct
// ─────────────────────────────────────────────────────────────────────────────

describe('useInventory — addProduct', () => {
    it('llama a addDoc con los datos del producto + createdAt', async () => {
        const { result } = renderHook(() => useInventory(mockUser, mockUserData));

        const data = { name: 'Coca Cola', price: 500, stock: 10, cost: 300 };
        await act(async () => { await result.current.addProduct(data); });

        expect(addDoc).toHaveBeenCalledTimes(1);
        const [, payload] = addDoc.mock.calls[0];
        expect(payload.name).toBe('Coca Cola');
        expect(payload.price).toBe(500);
        expect(payload.createdAt).toBeDefined();
    });

    it('retorna el documento creado por addDoc', async () => {
        addDoc.mockResolvedValueOnce({ id: 'prod-abc' });
        const { result } = renderHook(() => useInventory(mockUser, mockUserData));

        let ret;
        await act(async () => { ret = await result.current.addProduct({ name: 'Test' }); });

        expect(ret).toEqual({ id: 'prod-abc' });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateProduct
// ─────────────────────────────────────────────────────────────────────────────

describe('useInventory — updateProduct', () => {
    it('llama a updateDoc con el id y los nuevos datos', async () => {
        const { result } = renderHook(() => useInventory(mockUser, mockUserData));

        await act(async () => {
            await result.current.updateProduct('prod-1', { price: 600 });
        });

        expect(updateDoc).toHaveBeenCalledTimes(1);
        const [, payload] = updateDoc.mock.calls[0];
        expect(payload.price).toBe(600);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// deleteProduct — ahora es SOFT DELETE (Mejora 5)
// ─────────────────────────────────────────────────────────────────────────────

describe('useInventory — deleteProduct (soft delete)', () => {
    it('NO llama a deleteDoc (no borra el documento físicamente)', async () => {
        const { result } = renderHook(() => useInventory(mockUser, mockUserData));

        await act(async () => { await result.current.deleteProduct('prod-1'); });

        expect(deleteDoc).not.toHaveBeenCalled();
    });

    it('llama a updateDoc con isActive: false', async () => {
        const { result } = renderHook(() => useInventory(mockUser, mockUserData));

        await act(async () => { await result.current.deleteProduct('prod-1'); });

        expect(updateDoc).toHaveBeenCalledTimes(1);
        const [, payload] = updateDoc.mock.calls[0];
        expect(payload.isActive).toBe(false);
    });

    it('incluye deletedAt en el payload del soft delete', async () => {
        const { result } = renderHook(() => useInventory(mockUser, mockUserData));

        await act(async () => { await result.current.deleteProduct('prod-1'); });

        const [, payload] = updateDoc.mock.calls[0];
        expect(payload.deletedAt).toBeDefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// addStock
// ─────────────────────────────────────────────────────────────────────────────

describe('useInventory — addStock', () => {
    it('usa increment() atómico (no suma manualmente)', async () => {
        const { result } = renderHook(() => useInventory(mockUser, mockUserData));
        const product = { id: 'prod-1', name: 'Test', stock: 5 };

        await act(async () => { await result.current.addStock(product, 10); });

        expect(updateDoc).toHaveBeenCalledTimes(1);
        const [, payload] = updateDoc.mock.calls[0];
        // increment() está mockeado como vi.fn(v => v) → devuelve 10
        expect(payload.stock).toBe(10);
    });

    it('no llama a updateDoc si el producto es null', async () => {
        const { result } = renderHook(() => useInventory(mockUser, mockUserData));

        await act(async () => { await result.current.addStock(null, 5); });

        expect(updateDoc).not.toHaveBeenCalled();
    });

    it('no llama a updateDoc si la cantidad es 0', async () => {
        const { result } = renderHook(() => useInventory(mockUser, mockUserData));

        await act(async () => { await result.current.addStock({ id: 'p1' }, 0); });

        expect(updateDoc).not.toHaveBeenCalled();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// registerFaultyProduct
// ─────────────────────────────────────────────────────────────────────────────

describe('useInventory — registerFaultyProduct', () => {
    it('usa writeBatch para operación atómica (stock + gasto)', async () => {
        const { result } = renderHook(() => useInventory(mockUser, mockUserData));
        const product = { id: 'prod-1', name: 'Alfajor', cost: 200 };

        await act(async () => {
            await result.current.registerFaultyProduct(product, 3, 'Vencido');
        });

        expect(writeBatch).toHaveBeenCalledTimes(1);
        expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });

    it('decrementa el stock del producto fallado', async () => {
        const { result } = renderHook(() => useInventory(mockUser, mockUserData));
        const product = { id: 'prod-1', name: 'Alfajor', cost: 200 };

        await act(async () => {
            await result.current.registerFaultyProduct(product, 3, 'Vencido');
        });

        // batch.update debe haberse llamado con stock: increment(-3)
        // increment está mockeado como v => v, así que stock = -3
        const updateCall = mockBatch.update.mock.calls[0];
        expect(updateCall[1].stock).toBe(-3);
    });

    it('registra el gasto con monto basado en el costo del producto', async () => {
        const { result } = renderHook(() => useInventory(mockUser, mockUserData));
        const product = { id: 'prod-1', name: 'Coca', cost: 300 };

        await act(async () => {
            await result.current.registerFaultyProduct(product, 2, 'Rota');
        });

        // batch.set debe haberse llamado con amount = 300 * 2 = 600
        const setCall = mockBatch.set.mock.calls[0];
        expect(setCall[1].amount).toBe(600);
        expect(setCall[1].type).toBe('inventory_loss');
    });

    it('incluye el motivo en la descripción del gasto', async () => {
        const { result } = renderHook(() => useInventory(mockUser, mockUserData));
        const product = { id: 'p1', name: 'Leche', cost: 100 };

        await act(async () => {
            await result.current.registerFaultyProduct(product, 1, 'Se derramó');
        });

        const setCall = mockBatch.set.mock.calls[0];
        expect(setCall[1].description).toContain('Se derramó');
    });

    it('no hace nada si el producto es null', async () => {
        const { result } = renderHook(() => useInventory(mockUser, mockUserData));

        await act(async () => { await result.current.registerFaultyProduct(null, 1, ''); });

        expect(writeBatch).not.toHaveBeenCalled();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateInvitationCode
// ─────────────────────────────────────────────────────────────────────────────

describe('useInventory — generateInvitationCode', () => {
    it('devuelve un código de 8 caracteres', async () => {
        const { result } = renderHook(() => useInventory(mockUser, mockUserData));

        let code;
        await act(async () => { code = await result.current.generateInvitationCode(); });

        expect(code).toHaveLength(8);
    });

    it('el código es todo mayúsculas', async () => {
        const { result } = renderHook(() => useInventory(mockUser, mockUserData));

        let code;
        await act(async () => { code = await result.current.generateInvitationCode(); });

        expect(code).toBe(code.toUpperCase());
    });

    it('guarda el código en Firestore con status: active', async () => {
        const { result } = renderHook(() => useInventory(mockUser, mockUserData));

        await act(async () => { await result.current.generateInvitationCode(); });

        const [, payload] = addDoc.mock.calls[0];
        expect(payload.status).toBe('active');
        expect(payload.code).toBeDefined();
    });

    it('dos llamadas consecutivas generan códigos distintos', async () => {
        const { result } = renderHook(() => useInventory(mockUser, mockUserData));

        let code1, code2;
        await act(async () => { code1 = await result.current.generateInvitationCode(); });
        vi.clearAllMocks();
        addDoc.mockResolvedValue({ id: 'nuevo-id' });
        await act(async () => { code2 = await result.current.generateInvitationCode(); });

        // Es estadísticamente imposible que dos códigos de 8 chars colisionen
        expect(code1).not.toBe(code2);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Categorías, clientes y gastos — contratos básicos
// ─────────────────────────────────────────────────────────────────────────────

describe('useInventory — categorías', () => {
    it('addCategory agrega con isActive: true', async () => {
        const { result } = renderHook(() => useInventory(mockUser, mockUserData));

        await act(async () => { await result.current.addCategory('Bebidas'); });

        const [, payload] = addDoc.mock.calls[0];
        expect(payload.name).toBe('Bebidas');
        expect(payload.isActive).toBe(true);
    });

    it('deleteCategory llama a deleteDoc', async () => {
        const { result } = renderHook(() => useInventory(mockUser, mockUserData));

        await act(async () => { await result.current.deleteCategory('cat-1'); });

        expect(deleteDoc).toHaveBeenCalledTimes(1);
    });
});

describe('useInventory — clientes', () => {
    it('addCustomer incluye createdAt', async () => {
        const { result } = renderHook(() => useInventory(mockUser, mockUserData));

        await act(async () => {
            await result.current.addCustomer({ name: 'Juan', phone: '351-000' });
        });

        const [, payload] = addDoc.mock.calls[0];
        expect(payload.name).toBe('Juan');
        expect(payload.createdAt).toBeDefined();
    });
});

describe('useInventory — gastos', () => {
    it('addExpense incluye date (serverTimestamp)', async () => {
        const { result } = renderHook(() => useInventory(mockUser, mockUserData));

        await act(async () => {
            await result.current.addExpense({ description: 'Alquiler', amount: 5000 });
        });

        const [, payload] = addDoc.mock.calls[0];
        expect(payload.description).toBe('Alquiler');
        expect(payload.date).toBeDefined();
    });
});
