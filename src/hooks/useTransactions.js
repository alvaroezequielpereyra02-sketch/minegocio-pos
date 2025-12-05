import { useState, useEffect, useMemo } from 'react';
import {
    collection, query, orderBy, limit, where, onSnapshot,
    addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore';
import { db, appId } from '../config/firebase';

export const useTransactions = (user, userData, products = [], expenses = [], categories = []) => {
    const [transactions, setTransactions] = useState([]);
    const [lastTransactionId, setLastTransactionId] = useState(null);

    useEffect(() => {
        if (!user || !userData) return;

        let q;
        // Si es admin, traemos más historial para los reportes
        if (userData.role === 'admin') {
            q = query(collection(db, 'stores', appId, 'transactions'), orderBy('date', 'desc'), limit(500));
        } else {
            q = query(collection(db, 'stores', appId, 'transactions'), where('clientId', '==', user.uid), orderBy('date', 'desc'), limit(50));
        }

        // El snapshot se actualiza en tiempo real, incluso con datos locales (Offline)
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => unsubscribe();
    }, [user, userData]);

    const createTransaction = async (saleData, cartItems) => {
        // Firebase Offline: addDoc resuelve inmediatamente guardando en IndexedDB
        // y sincroniza en segundo plano cuando hay red.
        const docRef = await addDoc(collection(db, 'stores', appId, 'transactions'), saleData);

        cartItems.forEach(item => {
            const p = products.find(prod => prod.id === item.id);
            if (p) {
                // Actualización optimista del stock
                updateDoc(doc(db, 'stores', appId, 'products', item.id), { stock: p.stock - item.qty })
                    .catch(e => console.error("Error stock update", e));
            }
        });

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

    // --- CÁLCULOS AVANZADOS PARA REPORTES ---
    const balance = useMemo(() => {
        let salesPaid = 0, salesPending = 0, salesPartial = 0, costOfGoodsSold = 0, inventoryValue = 0;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        let todayCash = 0, todayDigital = 0, todayTotal = 0;

        // Datos para gráfico de barras (Últimos 7 días)
        const chartDataMap = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            chartDataMap[d.toLocaleDateString('es-ES', { weekday: 'short' })] = { name: d.toLocaleDateString('es-ES', { weekday: 'short' }), total: 0 };
        }

        // Datos para gráfico de Torta (Categorías)
        const categoryStats = {}; // { "Bebidas": 15000, "Snacks": 5000 }

        let totalExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);

        transactions.forEach(t => {
            const tDate = t.date?.seconds ? new Date(t.date.seconds * 1000) : new Date();

            if (t.type === 'sale') {
                // Solo sumamos a estadísticas si está pagado o parcialmente pagado
                if (t.paymentStatus === 'paid' || t.paymentStatus === 'partial') {
                    const amountToSum = t.paymentStatus === 'paid' ? t.total : (t.amountPaid || 0);

                    // Sumas generales
                    if (t.paymentStatus === 'paid') salesPaid += t.total;
                    else salesPartial += t.amountPaid || 0;

                    // Costos y Categorías (Iteramos items)
                    if (t.items) {
                        t.items.forEach(item => {
                            // Costo
                            costOfGoodsSold += (item.cost || 0) * item.qty;

                            // Categoría (Reporte Avanzado)
                            // Buscamos el nombre de la categoría usando el categoryId del producto
                            // Nota: Si el producto fue borrado, intentamos usar 'Varios'
                            let catName = 'Varios';
                            if (item.categoryId) {
                                const cat = categories.find(c => c.id === item.categoryId);
                                if (cat) catName = cat.name;
                            }

                            if (!categoryStats[catName]) categoryStats[catName] = 0;
                            // Sumamos el valor de venta de este item al total de la categoría
                            categoryStats[catName] += (item.price * item.qty);
                        });
                    }

                    // Métricas de HOY
                    if (tDate >= today) {
                        todayTotal += amountToSum;
                        if (t.paymentMethod === 'cash') todayCash += amountToSum;
                        else todayDigital += amountToSum;
                    }

                    // Gráfico de Barras
                    const dayLabel = tDate.toLocaleDateString('es-ES', { weekday: 'short' });
                    if (chartDataMap[dayLabel]) chartDataMap[dayLabel].total += amountToSum;
                }

                if (t.paymentStatus === 'pending') {
                    salesPending += t.total;
                }
            }
        });

        products.forEach(p => { inventoryValue += (p.price * p.stock); });

        // Convertir objeto de categorías a array para Recharts
        // Formato: [{ name: 'Bebidas', value: 15000 }, ...]
        const salesByCategory = Object.keys(categoryStats).map(key => ({
            name: key,
            value: categoryStats[key]
        })).sort((a, b) => b.value - a.value); // Ordenar de mayor a menor venta

        return {
            salesPaid, salesPending, salesPartial, inventoryValue, totalExpenses,
            grossProfit: salesPaid - costOfGoodsSold,
            netProfit: (salesPaid - costOfGoodsSold) - totalExpenses,
            costOfGoodsSold, todayCash, todayDigital, todayTotal,
            chartData: Object.values(chartDataMap),
            salesByCategory // <--- NUEVO DATO
        };
    }, [transactions, products, expenses, categories]);

    return { transactions, lastTransactionId, createTransaction, updateTransaction, deleteTransaction, balance };
};