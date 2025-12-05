import { useState, useEffect, useMemo } from 'react';
import {
    collection, query, orderBy, limit, where, onSnapshot,
    addDoc, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch
} from 'firebase/firestore';
import { db, appId } from '../config/firebase';

// Ahora aceptamos 'dateRange' como argumento
export const useTransactions = (user, userData, products = [], expenses = [], categories = [], dateRange = 'week') => {
    const [transactions, setTransactions] = useState([]);
    const [lastTransactionId, setLastTransactionId] = useState(null);

    // 1. Cargar Transacciones
    useEffect(() => {
        if (!user || !userData) return;

        let q;
        // Traemos suficientes datos para poder filtrar en memoria (últimos 500)
        if (userData.role === 'admin') {
            q = query(collection(db, 'stores', appId, 'transactions'), orderBy('date', 'desc'), limit(1000));
        } else {
            q = query(collection(db, 'stores', appId, 'transactions'), where('clientId', '==', user.uid), orderBy('date', 'desc'), limit(50));
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => unsubscribe();
    }, [user, userData]);

    // 2. Crear Transacción (Venta)
    const createTransaction = async (saleData, cartItems) => {
        const docRef = await addDoc(collection(db, 'stores', appId, 'transactions'), saleData);

        // Actualizar stock localmente (Optimista)
        cartItems.forEach(item => {
            const p = products.find(prod => prod.id === item.id);
            if (p) {
                updateDoc(doc(db, 'stores', appId, 'products', item.id), { stock: p.stock - item.qty })
                    .catch(e => console.error("Error stock update", e));
            }
        });

        // Registrar actividad de cliente
        if (saleData.clientId && saleData.clientId !== 'anonimo') {
            updateDoc(doc(db, 'stores', appId, 'customers', saleData.clientId), {
                externalOrdersCount: (saleData.externalOrdersCount || 0) + 1,
                lastPurchase: serverTimestamp()
            }).catch(() => { });
        }

        setLastTransactionId({ ...saleData, id: docRef.id, date: { seconds: Date.now() / 1000 } });
        return docRef.id;
    };

    const updateTransaction = async (id, data) => updateDoc(doc(db, 'stores', appId, 'transactions', id), data);
    const deleteTransaction = async (id) => deleteDoc(doc(db, 'stores', appId, 'transactions', id));

    // Función masiva para borrar todo (Purgar)
    const purgeTransactions = async () => {
        const batch = writeBatch(db);
        transactions.forEach(t => {
            const ref = doc(db, 'stores', appId, 'transactions', t.id);
            batch.delete(ref);
        });
        await batch.commit();
    };

    // 3. CÁLCULO DE BALANCE (Dinámico según Fecha)
    const balance = useMemo(() => {
        let salesPaid = 0, salesPending = 0, salesPartial = 0, costOfGoodsSold = 0, inventoryValue = 0;

        // Definir rango de fechas
        const now = new Date();
        const startDate = new Date();
        const daysToSubtract = dateRange === 'month' ? 30 : 7;
        startDate.setDate(now.getDate() - daysToSubtract);

        // Resetear horas para comparación justa
        startDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let todayCash = 0, todayDigital = 0, todayTotal = 0;

        // Inicializar mapa del gráfico
        const chartDataMap = {};
        for (let i = daysToSubtract - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            // Formato DD/MM para que ocupe menos espacio en móvil
            const key = d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
            chartDataMap[key] = { name: key, total: 0, fullDate: d };
        }

        // Datos por Categoría
        const categoryStats = {};

        // Filtrar transacciones dentro del rango para los gráficos
        // NOTA: Para los totales generales (salesPaid, etc) ¿quieres histórico total o solo del rango?
        // Normalmente un "Balance" muestra la foto actual de la deuda total, pero los gráficos muestran rendimiento temporal.
        // Aquí calcularemos TOTALES HISTÓRICOS para la deuda/caja, pero GRÁFICOS filtrados por fecha.

        let filteredExpenses = 0;

        // Calcular inventario actual (siempre es total)
        products.forEach(p => { inventoryValue += (p.price * p.stock); });

        // Sumar Gastos (Filtrados por fecha)
        expenses.forEach(e => {
            const eDate = e.date?.seconds ? new Date(e.date.seconds * 1000) : new Date();
            if (eDate >= startDate) {
                filteredExpenses += e.amount;
            }
        });

        transactions.forEach(t => {
            const tDate = t.date?.seconds ? new Date(t.date.seconds * 1000) : new Date();
            const isWithinRange = tDate >= startDate;

            if (t.type === 'sale') {

                // A) Totales Generales (Históricos)
                if (t.paymentStatus === 'paid') salesPaid += t.total;
                else if (t.paymentStatus === 'partial') {
                    salesPartial += t.amountPaid || 0;
                    salesPaid += t.amountPaid || 0; // Sumamos lo pagado al total recaudado
                }
                else if (t.paymentStatus === 'pending') salesPending += t.total;

                // B) Métricas de HOY
                if (tDate >= today) {
                    const amountToday = t.paymentStatus === 'paid' ? t.total : (t.amountPaid || 0);
                    todayTotal += amountToday;
                    if (t.paymentMethod === 'cash') todayCash += amountToday;
                    else todayDigital += amountToday;
                }

                // C) Datos Filtrados por Rango (Gráficos y Categorías)
                if (isWithinRange && (t.paymentStatus === 'paid' || t.paymentStatus === 'partial')) {
                    const amount = t.paymentStatus === 'paid' ? t.total : (t.amountPaid || 0);

                    // Gráfico de Barras
                    const dayLabel = tDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
                    if (chartDataMap[dayLabel]) {
                        chartDataMap[dayLabel].total += amount;
                    }

                    // Categorías y Costos
                    if (t.items) {
                        t.items.forEach(item => {
                            if (isWithinRange) costOfGoodsSold += (item.cost || 0) * item.qty;

                            let catName = 'Varios';
                            if (item.categoryId) {
                                const cat = categories.find(c => c.id === item.categoryId);
                                if (cat) catName = cat.name;
                            }
                            if (!categoryStats[catName]) categoryStats[catName] = 0;
                            categoryStats[catName] += (item.price * item.qty);
                        });
                    }
                }
            }
        });

        const salesByCategory = Object.keys(categoryStats).map(key => ({
            name: key,
            value: categoryStats[key]
        })).sort((a, b) => b.value - a.value);

        return {
            // Totales Históricos
            salesPaid, salesPending, salesPartial, inventoryValue,

            // Totales del Periodo (Para KPI de Ganancia)
            periodSales: Object.values(chartDataMap).reduce((a, b) => a + b.total, 0),
            periodExpenses: filteredExpenses,
            periodCost: costOfGoodsSold,
            periodNet: Object.values(chartDataMap).reduce((a, b) => a + b.total, 0) - filteredExpenses - costOfGoodsSold,

            // Del día
            todayCash, todayDigital, todayTotal,

            // Gráficos
            chartData: Object.values(chartDataMap),
            salesByCategory
        };
    }, [transactions, products, expenses, categories, dateRange]);

    return { transactions, lastTransactionId, createTransaction, updateTransaction, deleteTransaction, purgeTransactions, balance };
};