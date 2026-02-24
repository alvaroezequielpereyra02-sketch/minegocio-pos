import { describe, it, expect, beforeEach } from 'vitest';
import {
    getOfflineQueue,
    addToOfflineQueue,
    OFFLINE_QUEUE_KEY,
} from '../hooks/useSyncManager';

// ─────────────────────────────────────────────────────────────────────────────
// Tests de la cola offline (funciones puras — sin React, sin Firebase)
// Estas funciones son críticas: un bug aquí significa boletas perdidas.
// ─────────────────────────────────────────────────────────────────────────────

describe('Cola offline — getOfflineQueue', () => {
    it('devuelve un array vacío cuando localStorage está vacío', () => {
        const queue = getOfflineQueue();
        expect(queue).toEqual([]);
    });

    it('devuelve los items guardados correctamente', () => {
        const items = [{ localId: 'offline-1', saleData: { total: 500 } }];
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(items));

        const queue = getOfflineQueue();
        expect(queue).toHaveLength(1);
        expect(queue[0].localId).toBe('offline-1');
    });

    it('devuelve array vacío si localStorage tiene JSON corrupto', () => {
        localStorage.setItem(OFFLINE_QUEUE_KEY, 'esto-no-es-json{{{');
        const queue = getOfflineQueue();
        expect(queue).toEqual([]);
    });
});

describe('Cola offline — addToOfflineQueue', () => {
    it('agrega un item a una cola vacía', () => {
        const entry = { localId: 'offline-1', saleData: { total: 1000 }, itemsWithCost: [] };
        addToOfflineQueue(entry);

        const queue = getOfflineQueue();
        expect(queue).toHaveLength(1);
        expect(queue[0].localId).toBe('offline-1');
    });

    it('acumula múltiples items sin perder los anteriores', () => {
        addToOfflineQueue({ localId: 'offline-1', saleData: { total: 100 } });
        addToOfflineQueue({ localId: 'offline-2', saleData: { total: 200 } });
        addToOfflineQueue({ localId: 'offline-3', saleData: { total: 300 } });

        const queue = getOfflineQueue();
        expect(queue).toHaveLength(3);
        expect(queue.map(e => e.localId)).toEqual(['offline-1', 'offline-2', 'offline-3']);
    });

    it('persiste el total correctamente', () => {
        const entry = { localId: 'offline-1', saleData: { total: 4599 }, itemsWithCost: [] };
        addToOfflineQueue(entry);

        const queue = getOfflineQueue();
        expect(queue[0].saleData.total).toBe(4599);
    });

    it('persiste los items del pedido correctamente', () => {
        const items = [
            { id: 'prod-1', name: 'Coca Cola', qty: 2, price: 500, cost: 300 },
            { id: 'prod-2', name: 'Agua',      qty: 1, price: 200, cost: 100 },
        ];
        addToOfflineQueue({ localId: 'offline-1', saleData: { total: 1200 }, itemsWithCost: items });

        const queue = getOfflineQueue();
        expect(queue[0].itemsWithCost).toHaveLength(2);
        expect(queue[0].itemsWithCost[0].name).toBe('Coca Cola');
    });
});
