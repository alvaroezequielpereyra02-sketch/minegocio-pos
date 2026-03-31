import { describe, it, expect } from 'vitest';
import { calcBalance } from '../hooks/useTransactions';

// ─────────────────────────────────────────────────────────────────────────────
// calcBalance es una función pura exportada desde useTransactions.js.
// La testeamos directamente sin renderizar el hook ni mockear Firebase.
// Cualquier cambio en la lógica de balance queda cubierto automáticamente.
// ─────────────────────────────────────────────────────────────────────────────

// Timestamp de "hoy" (hace 1 minuto — offset mínimo para evitar cruzar medianoche)
const nowTs = () => ({ seconds: Math.floor((Date.now() - 60000) / 1000) });
// Timestamp de "esta semana" (hace 3 días)
const weekTs = () => ({ seconds: Math.floor((Date.now() - 3 * 86400000) / 1000) });
// Timestamp fuera del rango (hace 40 días)
const oldTs = () => ({ seconds: Math.floor((Date.now() - 40 * 86400000) / 1000) });

const items = [{ id: 'p1', name: 'Coca', qty: 2, price: 500, cost: 300, categoryId: 'cat1' }];

// ─────────────────────────────────────────────────────────────────────────────
// Estado vacío
// ─────────────────────────────────────────────────────────────────────────────

describe('balance — estado vacío', () => {
    it('todos los contadores son 0 sin datos', () => {
        const b = calcBalance({});
        expect(b.salesPaid).toBe(0);
        expect(b.salesPending).toBe(0);
        expect(b.salesPartial).toBe(0);
        expect(b.todayTotal).toBe(0);
        expect(b.inventoryValue).toBe(0);
        expect(b.periodNet).toBe(0);
    });

    it('chartData tiene 7 entradas con total 0 para rango semanal', () => {
        const b = calcBalance({ dateRange: 'week' });
        expect(b.chartData).toHaveLength(7);
        expect(b.chartData.every(d => d.total === 0)).toBe(true);
    });

    it('chartData tiene 30 entradas para rango mensual', () => {
        const b = calcBalance({ dateRange: 'month' });
        expect(b.chartData).toHaveLength(30);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// salesPaid / salesPending / salesPartial
// ─────────────────────────────────────────────────────────────────────────────

describe('balance — contadores de ventas', () => {
    it('suma correctamente ventas pagadas', () => {
        const transactions = [
            { id: '1', type: 'sale', total: 1000, paymentStatus: 'paid', date: nowTs() },
            { id: '2', type: 'sale', total: 2000, paymentStatus: 'paid', date: nowTs() },
        ];
        const b = calcBalance({ transactions });
        expect(b.salesPaid).toBe(3000);
    });

    it('suma correctamente ventas pendientes de pago', () => {
        const transactions = [
            { id: '1', type: 'sale', total: 1500, paymentStatus: 'pending', date: nowTs() },
        ];
        const b = calcBalance({ transactions });
        expect(b.salesPending).toBe(1500);
        expect(b.salesPaid).toBe(0);
    });

    it('pago parcial: salesPartial = lo cobrado, salesPending = el saldo restante', () => {
        const transactions = [
            { id: '1', type: 'sale', total: 1000, amountPaid: 400, paymentStatus: 'partial', date: nowTs() },
        ];
        const b = calcBalance({ transactions });
        expect(b.salesPartial).toBe(400);   // cobrado
        expect(b.salesPending).toBe(600);   // restante
        expect(b.salesPaid).toBe(0);
    });

    it('no hay doble suma en pago parcial (bug corregido en v20)', () => {
        const transactions = [
            { id: '1', type: 'sale', total: 1000, amountPaid: 400, paymentStatus: 'partial', date: nowTs() },
        ];
        const b = calcBalance({ transactions });
        // salesPending NO debe incluir también el total completo
        expect(b.salesPending).toBe(600);
        expect(b.salesPending).not.toBe(1000);
    });

    it('mezcla correctamente los tres estados en una misma tirada', () => {
        const transactions = [
            { id: '1', type: 'sale', total: 1000, paymentStatus: 'paid', date: nowTs() },
            { id: '2', type: 'sale', total: 800,  paymentStatus: 'pending', date: nowTs() },
            { id: '3', type: 'sale', total: 600,  amountPaid: 200, paymentStatus: 'partial', date: nowTs() },
        ];
        const b = calcBalance({ transactions });
        expect(b.salesPaid).toBe(1000);
        expect(b.salesPending).toBe(800 + 400); // 800 pendiente + 400 saldo parcial
        expect(b.salesPartial).toBe(200);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Ventas de hoy (todayTotal, todayCash, todayDigital)
// ─────────────────────────────────────────────────────────────────────────────

describe('balance — ventas del día', () => {
    it('suma ventas pagas de hoy en todayTotal', () => {
        const transactions = [
            { id: '1', type: 'sale', total: 1000, paymentStatus: 'paid', paymentMethod: 'cash', date: nowTs() },
        ];
        const b = calcBalance({ transactions });
        expect(b.todayTotal).toBe(1000);
        expect(b.todayCash).toBe(1000);
        expect(b.todayDigital).toBe(0);
    });

    it('usa amountPaid (no total) para ventas parciales de hoy', () => {
        const transactions = [
            { id: '1', type: 'sale', total: 1000, amountPaid: 300, paymentStatus: 'partial', paymentMethod: 'transfer', date: nowTs() },
        ];
        const b = calcBalance({ transactions });
        expect(b.todayTotal).toBe(300);
        expect(b.todayDigital).toBe(300);
    });

    it('no cuenta ventas de días anteriores en todayTotal', () => {
        const transactions = [
            { id: '1', type: 'sale', total: 5000, paymentStatus: 'paid', paymentMethod: 'cash', date: weekTs() },
        ];
        const b = calcBalance({ transactions });
        expect(b.todayTotal).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Rango de fechas
// ─────────────────────────────────────────────────────────────────────────────

describe('balance — rango de fechas', () => {
    it('excluye transacciones fuera del rango semanal', () => {
        const transactions = [
            { id: '1', type: 'sale', total: 999, paymentStatus: 'paid', date: oldTs() }, // hace 40 días
        ];
        const b = calcBalance({ transactions, dateRange: 'week' });
        expect(b.periodSales).toBe(0);
    });

    it('acepta el alias "30days" como rango mensual', () => {
        const b30 = calcBalance({ dateRange: '30days' });
        const bMonth = calcBalance({ dateRange: 'month' });
        expect(b30.chartData).toHaveLength(30);
        expect(bMonth.chartData).toHaveLength(30);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Inventario y gastos
// ─────────────────────────────────────────────────────────────────────────────

describe('balance — inventario y gastos', () => {
    it('calcula el valor de inventario correctamente', () => {
        const products = [
            { id: 'p1', price: 500, stock: 10 },
            { id: 'p2', price: 200, stock: 5 },
        ];
        const b = calcBalance({ products });
        expect(b.inventoryValue).toBe(6000); // 500*10 + 200*5
    });

    it('maneja stock negativo sin crashear (negocio por demanda)', () => {
        const products = [{ id: 'p1', price: 500, stock: -3 }];
        const b = calcBalance({ products });
        // stock negativo → valor negativo de inventario, es correcto
        expect(b.inventoryValue).toBe(-1500);
    });

    it('suma gastos del periodo', () => {
        const expenses = [
            { id: 'e1', amount: 500,  date: nowTs() },
            { id: 'e2', amount: 1000, date: weekTs() },
        ];
        const b = calcBalance({ expenses });
        expect(b.periodExpenses).toBe(1500);
    });

    it('excluye gastos fuera del periodo', () => {
        const expenses = [{ id: 'e1', amount: 9999, date: oldTs() }];
        const b = calcBalance({ expenses });
        expect(b.periodExpenses).toBe(0);
    });

    it('calcula el COGS (costo de mercadería vendida) en ventas del periodo', () => {
        const transactions = [{
            id: '1', type: 'sale', total: 1000, paymentStatus: 'paid', date: weekTs(),
            items: [{ id: 'p1', qty: 2, price: 500, cost: 300 }]
        }];
        const b = calcBalance({ transactions });
        expect(b.periodCost).toBe(600); // 2 × $300
    });

    it('periodNet = periodSales - gastos - COGS', () => {
        const transactions = [{
            id: '1', type: 'sale', total: 1000, paymentStatus: 'paid', date: weekTs(),
            items: [{ id: 'p1', qty: 1, price: 1000, cost: 400 }]
        }];
        const expenses = [{ id: 'e1', amount: 200, date: weekTs() }];
        const b = calcBalance({ transactions, expenses });
        // periodSales = 1000, cogs = 400, expenses = 200 → net = 400
        expect(b.periodNet).toBe(400);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Ventas por categoría
// ─────────────────────────────────────────────────────────────────────────────

describe('balance — ventas por categoría', () => {
    it('agrupa items sin categoría bajo "Varios"', () => {
        const transactions = [{
            id: '1', type: 'sale', total: 1000, paymentStatus: 'paid', date: weekTs(),
            items: [{ id: 'p1', qty: 1, price: 1000, cost: 0 }] // sin categoryId
        }];
        const b = calcBalance({ transactions });
        expect(b.salesByCategory[0].name).toBe('Varios');
    });

    it('usa el nombre de categoría cuando está disponible', () => {
        const categories = [{ id: 'cat1', name: 'Bebidas' }];
        const transactions = [{
            id: '1', type: 'sale', total: 1000, paymentStatus: 'paid', date: weekTs(),
            items: [{ id: 'p1', qty: 1, price: 1000, cost: 0, categoryId: 'cat1' }]
        }];
        const b = calcBalance({ transactions, categories });
        expect(b.salesByCategory[0].name).toBe('Bebidas');
    });

    it('ordena categorías de mayor a menor venta', () => {
        const categories = [
            { id: 'c1', name: 'Bebidas' },
            { id: 'c2', name: 'Snacks' },
        ];
        const transactions = [{
            id: '1', type: 'sale', total: 3000, paymentStatus: 'paid', date: weekTs(),
            items: [
                { id: 'p1', qty: 1, price: 1000, cost: 0, categoryId: 'c1' },
                { id: 'p2', qty: 1, price: 2000, cost: 0, categoryId: 'c2' },
            ]
        }];
        const b = calcBalance({ transactions, categories });
        expect(b.salesByCategory[0].name).toBe('Snacks');   // más alto
        expect(b.salesByCategory[1].name).toBe('Bebidas');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Robustez ante datos malformados (valores undefined, null, cadenas)
// ─────────────────────────────────────────────────────────────────────────────

describe('balance — robustez ante datos malformados', () => {
    it('no crashea con total undefined en una transacción', () => {
        const transactions = [
            { id: '1', type: 'sale', total: undefined, paymentStatus: 'paid', date: nowTs() },
        ];
        expect(() => calcBalance({ transactions })).not.toThrow();
    });

    it('no crashea con price undefined en un producto', () => {
        const products = [{ id: 'p1', price: undefined, stock: 5 }];
        expect(() => calcBalance({ products })).not.toThrow();
    });

    it('ignora transacciones que no son de tipo "sale"', () => {
        const transactions = [
            { id: '1', type: 'expense', total: 9999, paymentStatus: 'paid', date: nowTs() },
        ];
        const b = calcBalance({ transactions });
        expect(b.salesPaid).toBe(0);
    });
});
