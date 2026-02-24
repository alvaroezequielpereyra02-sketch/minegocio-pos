import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSyncManager, addToOfflineQueue, getOfflineQueue } from '../hooks/useSyncManager';

// ── Mockeamos fetch globalmente ───────────────────────────────────────────────
// checkRealInternet usa fetch internamente. Mockeando fetch controlamos
// si el ping a google retorna éxito (online) o falla (offline).
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const simulateOnline  = () => mockFetch.mockResolvedValue({ status: 204 });
const simulateOffline = () => mockFetch.mockRejectedValue(new Error('Network error'));

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────
const mockUser              = { uid: 'user-123' };
const mockCreateTransaction = vi.fn();
const mockShowNotification  = vi.fn();

const makeEntry = (id, total = 1000) => ({
    localId:       `offline-${id}`,
    itemsWithCost: [{ id: 'prod-1', name: 'Test', qty: 1, price: total, cost: 0 }],
    saleData:      { type: 'sale', total, date: { seconds: 1700000000 } },
});

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('useSyncManager — estado inicial', () => {
    it('pendingCount es 0 cuando la cola está vacía', () => {
        const { result } = renderHook(() =>
            useSyncManager({ user: mockUser, createTransaction: mockCreateTransaction, showNotification: mockShowNotification })
        );
        expect(result.current.pendingCount).toBe(0);
    });

    it('pendingCount refleja las boletas que ya estaban en localStorage', () => {
        addToOfflineQueue(makeEntry(1));
        addToOfflineQueue(makeEntry(2));

        const { result } = renderHook(() =>
            useSyncManager({ user: mockUser, createTransaction: mockCreateTransaction, showNotification: mockShowNotification })
        );
        expect(result.current.pendingCount).toBe(2);
    });
});

describe('useSyncManager — syncQueue sin conexión', () => {
    it('no llama a createTransaction si no hay internet', async () => {
        simulateOffline();
        addToOfflineQueue(makeEntry(1));

        const { result } = renderHook(() =>
            useSyncManager({ user: mockUser, createTransaction: mockCreateTransaction, showNotification: mockShowNotification })
        );

        await act(async () => { await result.current.syncQueue(); });

        expect(mockCreateTransaction).not.toHaveBeenCalled();
    });

    it('no modifica la cola si no hay internet', async () => {
        simulateOffline();
        addToOfflineQueue(makeEntry(1));
        addToOfflineQueue(makeEntry(2));

        const { result } = renderHook(() =>
            useSyncManager({ user: mockUser, createTransaction: mockCreateTransaction, showNotification: mockShowNotification })
        );

        await act(async () => { await result.current.syncQueue(); });

        expect(getOfflineQueue()).toHaveLength(2);
    });
});

describe('useSyncManager — syncQueue con conexión', () => {
    beforeEach(() => {
        simulateOnline();
        mockCreateTransaction.mockResolvedValue({ id: 'tx-synced' });
    });

    it('sincroniza todas las boletas pendientes', async () => {
        addToOfflineQueue(makeEntry(1, 500));
        addToOfflineQueue(makeEntry(2, 1000));
        addToOfflineQueue(makeEntry(3, 750));

        const { result } = renderHook(() =>
            useSyncManager({ user: mockUser, createTransaction: mockCreateTransaction, showNotification: mockShowNotification })
        );

        await act(async () => { await result.current.syncQueue(); });

        expect(mockCreateTransaction).toHaveBeenCalledTimes(3);
    });

    it('vacía la cola tras sincronizar correctamente', async () => {
        addToOfflineQueue(makeEntry(1));
        addToOfflineQueue(makeEntry(2));

        const { result } = renderHook(() =>
            useSyncManager({ user: mockUser, createTransaction: mockCreateTransaction, showNotification: mockShowNotification })
        );

        await act(async () => { await result.current.syncQueue(); });

        expect(getOfflineQueue()).toHaveLength(0);
        expect(result.current.pendingCount).toBe(0);
    });

    it('muestra notificación con la cantidad de boletas sincronizadas', async () => {
        addToOfflineQueue(makeEntry(1));
        addToOfflineQueue(makeEntry(2));

        const { result } = renderHook(() =>
            useSyncManager({ user: mockUser, createTransaction: mockCreateTransaction, showNotification: mockShowNotification })
        );

        await act(async () => { await result.current.syncQueue(); });

        expect(mockShowNotification).toHaveBeenCalledWith(expect.stringContaining('2'));
    });

    it('no hace nada si la cola ya estaba vacía', async () => {
        const { result } = renderHook(() =>
            useSyncManager({ user: mockUser, createTransaction: mockCreateTransaction, showNotification: mockShowNotification })
        );

        await act(async () => { await result.current.syncQueue(); });

        expect(mockCreateTransaction).not.toHaveBeenCalled();
    });
});

describe('useSyncManager — fallo parcial en sincronización', () => {
    beforeEach(() => {
        simulateOnline();
    });

    it('continúa con las demás boletas si una falla', async () => {
        addToOfflineQueue(makeEntry(1));
        addToOfflineQueue(makeEntry(2));
        addToOfflineQueue(makeEntry(3));

        mockCreateTransaction
            .mockResolvedValueOnce({ id: 'tx-1' })
            .mockRejectedValueOnce(new Error('Firestore error'))
            .mockResolvedValueOnce({ id: 'tx-3' });

        const { result } = renderHook(() =>
            useSyncManager({ user: mockUser, createTransaction: mockCreateTransaction, showNotification: mockShowNotification })
        );

        await act(async () => { await result.current.syncQueue(); });

        expect(mockCreateTransaction).toHaveBeenCalledTimes(3);
    });

    it('mantiene en cola las boletas que fallaron', async () => {
        addToOfflineQueue(makeEntry(1));
        addToOfflineQueue(makeEntry(2));

        mockCreateTransaction
            .mockResolvedValueOnce({ id: 'tx-1' })
            .mockRejectedValueOnce(new Error('Firestore error'));

        const { result } = renderHook(() =>
            useSyncManager({ user: mockUser, createTransaction: mockCreateTransaction, showNotification: mockShowNotification })
        );

        await act(async () => { await result.current.syncQueue(); });

        expect(getOfflineQueue()).toHaveLength(1);
        expect(result.current.pendingCount).toBe(1);
    });

    it('notifica cuántas boletas quedan pendientes tras fallo parcial', async () => {
        addToOfflineQueue(makeEntry(1));
        addToOfflineQueue(makeEntry(2));

        mockCreateTransaction
            .mockResolvedValueOnce({ id: 'tx-1' })
            .mockRejectedValueOnce(new Error('Firestore error'));

        const { result } = renderHook(() =>
            useSyncManager({ user: mockUser, createTransaction: mockCreateTransaction, showNotification: mockShowNotification })
        );

        await act(async () => { await result.current.syncQueue(); });

        expect(mockShowNotification).toHaveBeenCalledWith(expect.stringContaining('1'));
    });
});
