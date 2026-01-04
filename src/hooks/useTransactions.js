import { useState, useEffect, useMemo } from 'react';
import {
    collection, query, orderBy, limit, where, onSnapshot,
    addDoc, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch, getDoc, increment
} from 'firebase/firestore';
import { db, appId } from '../config/firebase';

export const useTransactions = (user, userData, products = [], expenses = [], categories = [], dateRange = 'week') => {
    const [transactions, setTransactions] = useState([]);
    const [lastTransactionId, setLastTransactionId] = useState(null);

    // 1. Cargar Transacciones
    useEffect(() => {
        if (!user || !userData) return;

        let q;
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
        const batch = writeBatch(db);

        // A) Crear el documento de venta
        const transactionRef = doc(collection(db, 'stores', appId, 'transactions'));
        batch.set(transactionRef, saleData);

        // B) Descontar Stock (Atómico)
        cartItems.forEach(item => {
            const productRef = doc(db, 'stores', appId, 'products', item.id);
            // Usamos increment(-qty) para restar de forma segura
            batch.update(productRef, { stock: increment(-item.qty) });
        });

        // C) Actualizar cliente (si corresponde)
        if (saleData.clientId && saleData.clientId !== 'anonimo') {
            const customerRef = doc(db, 'stores', appId, 'customers', saleData.clientId);
            batch.update(customerRef, {
                externalOrdersCount: increment(1),
                lastPurchase: serverTimestamp()
            });
        }

        await batch.commit();

        const fullTransaction = {
            ...saleData,
            id: transactionRef.id,
            date: { seconds: Date.now() / 1000 }
        };

        setLastTransactionId(fullTransaction);
        return fullTransaction; // Ahora devolvemos el objeto completo
    };

    // 3. Actualizar Transacción (¡CON AJUSTE DE STOCK INTELIGENTE!)
    const updateTransaction = async (id, data) => {
        // Si no estamos modificando items, hacemos un update simple y rápido
        if (!data.items) {
            await updateDoc(doc(db, 'stores', appId, 'transactions', id), data);
            return;
        }

        // SI HAY CAMBIOS EN ITEMS, TENEMOS QUE AJUSTAR EL STOCK
        const batch = writeBatch(db);
        const transactionRef = doc(db, 'stores', appId, 'transactions', id);

        // 1. Obtener la transacción original antes de tocarla
        const oldTransactionSnap = await getDoc(transactionRef);
        if (!oldTransactionSnap.exists()) throw new Error("Transacción no existe");
        const oldItems = oldTransactionSnap.data().items || [];
        const newItems = data.items;

        // 2. Revertir el stock de los items viejos (Devolver todo a la estantería)
        oldItems.forEach(item => {
            const productRef = doc(db, 'stores', appId, 'products', item.id);
            batch.update(productRef, { stock: increment(item.qty) });
        });

        // 3. Descontar el stock de los items nuevos (Sacar lo nuevo de la estantería)
        newItems.forEach(item => {
            const productRef = doc(db, 'stores', appId, 'products', item.id);
            batch.update(productRef, { stock: increment(-item.qty) });
        });

        // 4. Guardar los cambios en la transacción
        batch.update(transactionRef, data);

        await batch.commit();
    };

    // 4. Borrar Transacción (¡DEVOLVIENDO EL STOCK!)
    const deleteTransaction = async (id) => {
        const batch = writeBatch(db);
        const transactionRef = doc(db, 'stores', appId, 'transactions', id);

        // 1. Leer qué tenía la transacción para devolverlo
        const transactionSnap = await getDoc(transactionRef);
        if (!transactionSnap.exists()) return; // Ya estaba borrada

        const transactionData = transactionSnap.data();

        // 2. Devolver mercadería al stock (si era una venta)
        if (transactionData.type === 'sale' && transactionData.items) {
            transactionData.items.forEach(item => {
                const productRef = doc(db, 'stores', appId, 'products', item.id);
                // Sumamos la cantidad que se había llevado
                batch.update(productRef, { stock: increment(item.qty) });
            });
        }

        // 3. Borrar el documento
        batch.delete(transactionRef);

        await batch.commit();
    };

    // Función masiva para borrar todo (Purgar)
    const purgeTransactions = async () => {
        const batch = writeBatch(db);
        transactions.forEach(t => {
            const ref = doc(db, 'stores', appId, 'transactions', t.id);
            batch.delete(ref);
        });
        await batch.commit();
    };

    // 5. CÁLCULO DE BALANCE (Igual que antes)
    const balance = useMemo(() => {
        let salesPaid = 0, salesPending = 0, salesPartial = 0, costOfGoodsSold = 0, inventoryValue = 0;
        const now = new Date();
        const startDate = new Date();
        const daysToSubtract = dateRange === 'month' ? 30 : 7;
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
            chartDataMap[key] = { name: key, total: 0, fullDate: d };
        }

        const categoryStats = {};
        let filteredExpenses = 0;

        products.forEach(p => { inventoryValue += (p.price * p.stock); });

        expenses.forEach(e => {
            const eDate = e.date?.seconds ? new Date(e.date.seconds * 1000) : new Date();
            if (eDate >= startDate) filteredExpenses += e.amount;
        });

        transactions.forEach(t => {
            const tDate = t.date?.seconds ? new Date(t.date.seconds * 1000) : new Date();
            const isWithinRange = tDate >= startDate;

            if (t.type === 'sale') {
                if (t.paymentStatus === 'paid') salesPaid += t.total;
                else if (t.paymentStatus === 'partial') {
                    salesPartial += t.amountPaid || 0;
                    salesPaid += t.amountPaid || 0;
                }
                else if (t.paymentStatus === 'pending') salesPending += t.total;

                if (tDate >= today) {
                    const amountToday = t.paymentStatus === 'paid' ? t.total : (t.amountPaid || 0);
                    todayTotal += amountToday;
                    if (t.paymentMethod === 'cash') todayCash += amountToday;
                    else todayDigital += amountToday;
                }

                if (isWithinRange && (t.paymentStatus === 'paid' || t.paymentStatus === 'partial')) {
                    const amount = t.paymentStatus === 'paid' ? t.total : (t.amountPaid || 0);
                    const dayLabel = tDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
                    if (chartDataMap[dayLabel]) chartDataMap[dayLabel].total += amount;

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
            salesPaid, salesPending, salesPartial, inventoryValue,
            periodSales: Object.values(chartDataMap).reduce((a, b) => a + b.total, 0),
            periodExpenses: filteredExpenses,
            periodCost: costOfGoodsSold,
            periodNet: Object.values(chartDataMap).reduce((a, b) => a + b.total, 0) - filteredExpenses - costOfGoodsSold,
            todayCash, todayDigital, todayTotal,
            chartData: Object.values(chartDataMap),
            salesByCategory
        };
    }, [transactions, products, expenses, categories, dateRange]);

    return { transactions, lastTransactionId, createTransaction, updateTransaction, deleteTransaction, purgeTransactions, balance };
};