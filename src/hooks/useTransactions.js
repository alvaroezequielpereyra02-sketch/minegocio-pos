/**
 * useTransactions — Fase 3A
 *
 * Reemplaza Firestore por Supabase a través de transactionsService.
 * calcBalance queda EXACTAMENTE igual que en la versión anterior — es
 * matemática pura sobre arrays ya cargados, no le importa de dónde
 * vinieron los datos.
 *
 * `createTransaction(saleData, items)` mantiene la misma firma que ya
 * usan useCheckout.js y useSyncManager.js — son quienes construyen esos
 * parámetros, acá solo se adapta la forma a lo que espera nuestra API.
 */
import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { transactionsService } from '../services/transactions.js';

// ─────────────────────────────────────────────────────────────────────────────
// calcBalance — función pura exportada, SIN CAMBIOS respecto a la versión
// anterior. Separada del hook para poder importarla directamente en los
// tests sin necesidad de renderizar el hook completo.
// ─────────────────────────────────────────────────────────────────────────────
export function calcBalance({ transactions = [], products = [], expenses = [], categories = [], dateRange = 'week' }) {
    let salesPaid = 0, salesPending = 0, salesPartial = 0, costOfGoodsSold = 0, inventoryValue = 0;
    const now = new Date();
    const startDate = new Date();

    const isMonth = dateRange === 'month' || dateRange === '30' || dateRange === '30days';
    const daysToSubtract = isMonth ? 30 : 7;

    startDate.setDate(now.getDate() - daysToSubtract);
    startDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let todayCash = 0, todayDigital = 0, todayTotal = 0;
    const chartDataMap = {};

    for (let i = daysToSubtract - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
        chartDataMap[key] = { name: key, total: 0 };
    }

    const catMap = new Map(categories.map(c => [c.id, c.name]));

    const categoryStats = {};
    let filteredExpenses = 0;

    products.forEach(p => {
        inventoryValue += (Number(p.price || 0) * Number(p.stock || 0));
    });

    expenses.forEach(e => {
        const eDate = e.date?.seconds ? new Date(e.date.seconds * 1000) : new Date(e.date);
        if (eDate >= startDate) filteredExpenses += Number(e.amount || 0);
    });

    transactions.forEach(t => {
        const tDate = t.date?.seconds ? new Date(t.date.seconds * 1000) : new Date(t.date);
        const isWithinRange = tDate >= startDate;

        if (t.type === 'sale') {
            const currentTotal = Number(t.total || 0);
            const currentPaid  = Number(t.amountPaid || 0);

            if (t.paymentStatus === 'paid') salesPaid += currentTotal;
            else if (t.paymentStatus === 'partial') {
                salesPartial += currentPaid;
                salesPending += (currentTotal - currentPaid);
            }
            else if (t.paymentStatus === 'pending') salesPending += currentTotal;

            if (tDate >= today) {
                const amountToday = t.paymentStatus === 'paid' ? currentTotal : currentPaid;
                todayTotal += amountToday;
                if (t.paymentMethod === 'cash') todayCash += amountToday;
                else todayDigital += amountToday;
            }

            if (isWithinRange && (t.paymentStatus === 'paid' || t.paymentStatus === 'partial')) {
                const amount   = t.paymentStatus === 'paid' ? currentTotal : currentPaid;
                const dayLabel = tDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
                if (chartDataMap[dayLabel]) chartDataMap[dayLabel].total += amount;

                if (t.items) {
                    t.items.forEach(item => {
                        costOfGoodsSold += (Number(item.cost || 0) * Number(item.qty || 0));
                        const catName = (item.categoryId && catMap.get(item.categoryId)) || 'Varios';
                        if (!categoryStats[catName]) categoryStats[catName] = 0;
                        categoryStats[catName] += (Number(item.price || 0) * Number(item.qty || 0));
                    });
                }
            }
        }
    });

    const salesByCategory = Object.keys(categoryStats).map(key => ({
        name: key, value: categoryStats[key]
    })).sort((a, b) => b.value - a.value);

    const totalPeriodSales = Object.values(chartDataMap).reduce((acc, curr) => acc + curr.total, 0);

    return {
        salesPaid, salesPending, salesPartial, inventoryValue,
        periodSales: totalPeriodSales,
        periodExpenses: filteredExpenses,
        periodCost: costOfGoodsSold,
        periodNet: totalPeriodSales - filteredExpenses - costOfGoodsSold,
        todayCash, todayDigital, todayTotal,
        chartData: Object.values(chartDataMap),
        salesByCategory,
    };
}

// ─────────────────────────────────────────────────────────────────────────────

export const useTransactions = (user, userData, products = [], expenses = [], categories = [], dateRange = 'week') => {
    const queryClient = useQueryClient();

    const { data: transactions = [] } = useQuery({
        queryKey: ['transactions'],
        queryFn:  () => transactionsService.getAll(),
        enabled:  !!user && !!userData,
    });

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        queryClient.invalidateQueries({ queryKey: ['products'] }); // el stock cambió
    };

    // ── Crear (checkout) ─────────────────────────────────────────────────────
    //
    // El backend vuelve a resolver quién es el cliente de forma autoritativa
    // a partir del rol real del usuario logueado — acá solo le pasamos
    // `customerId` cuando corresponde a una venta asignada a alguien de la
    // libreta del POS. Nunca confiamos en el resto de los campos de cliente
    // que ya vengan resueltos del lado del frontend.
    const createTransaction = async (saleData, cartItems) => {
        const payload = {
            items: cartItems.map(i => ({
                productId:     i.id,
                name:          i.name,
                qty:           i.qty,
                price:         i.price,
                originalPrice: i.originalPrice,
                cost:          i.cost,
                offerId:       i.offerId,
                isWholesale:   i.isWholesale,
                categoryId:    products.find(p => p.id === i.id)?.categoryId || null,
            })),
            total:         saleData.total,
            paymentMethod: saleData.paymentMethod,
            deliveryType:  saleData.deliveryType,
            customerId:    saleData.clientRole === 'customer' ? saleData.clientId : undefined,
            notes:         saleData.notes,
        };
        const fullTransaction = await transactionsService.create(payload);
        invalidate();
        return fullTransaction;
    };

    // ── Actualizar ───────────────────────────────────────────────────────────
    const updateTransaction = async (id, data) => {
        const cleanData = Object.fromEntries(
            Object.entries(data).filter(([, value]) => value !== undefined)
        );

        if (cleanData.items && cleanData.items.length === 0 && Number(cleanData.total) === 0) {
            console.error('Bloqueo preventivo: Se intentó guardar una boleta vacía.');
            return;
        }

        const payload = { ...cleanData };
        if (cleanData.items) {
            payload.items = cleanData.items.map(i => ({
                productId:     i.id || i.productId,
                name:          i.name,
                qty:           i.qty,
                price:         i.price,
                originalPrice: i.originalPrice,
                cost:          i.cost,
                offerId:       i.offerId,
                isWholesale:   i.isWholesale,
                categoryId:    i.categoryId || products.find(p => p.id === (i.id || i.productId))?.categoryId || null,
            }));
        }

        const result = await transactionsService.update(id, payload);
        invalidate();
        return result;
    };

    // ── Eliminar ─────────────────────────────────────────────────────────────
    const deleteTransaction = async (id) => {
        await transactionsService.delete(id);
        invalidate();
    };

    // ── Purgar todo (admin) ──────────────────────────────────────────────────
    // TEMPORAL: todavía no migrado — es una operación destructiva poco
    // frecuente (borra TODAS las transacciones) y se dejó para una pasada
    // aparte en vez de arriesgarla dentro de esta migración. Si la tocás
    // desde App.jsx antes de que la migremos, vas a ver este error en
    // vez de que borre algo a medias.
    const purgeTransactions = async () => {
        throw new Error('purgeTransactions todavía no está migrado a Supabase — avisale a Claude para sumarlo.');
    };

    const balance = useMemo(() =>
        calcBalance({ transactions, products, expenses, categories, dateRange }),
    [transactions, products, expenses, categories, dateRange]);

    return {
        transactions,
        lastTransactionId: null, // confirmado sin uso en ningún componente — se deja solo por compatibilidad de forma
        createTransaction, updateTransaction, deleteTransaction, purgeTransactions,
        balance,
    };
};
