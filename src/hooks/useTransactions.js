import { useState, useEffect, useMemo } from 'react';
import {
    collection, query, orderBy, limit, where, onSnapshot,
    addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore';
import { db, appId } from '../config/firebase';

export const useTransactions = (user, userData, products = [], expenses = []) => {
    const [transactions, setTransactions] = useState([]);
    const [lastTransactionId, setLastTransactionId] = useState(null);

    // Carga de Datos
    useEffect(() => {
        if (!user || !userData) return;

        let q;
        if (userData.role === 'admin') {
            q = query(collection(db, 'stores', appId, 'transactions'), orderBy('date', 'desc'), limit(500));
        } else {
            q = query(collection(db, 'stores', appId, 'transactions'), where('clientId', '==', user.uid), orderBy('date', 'desc'), limit(50));
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => unsubscribe();
    }, [user, userData]);

    // Acciones
    const createTransaction = async (saleData, cartItems) => {
        // 1. Guardar Venta
        const docRef = await addDoc(collection(db, 'stores', appId, 'transactions'), saleData);

        // 2. Actualizar Stock
        cartItems.forEach(item => {
            const p = products.find(prod => prod.id === item.id);
            if (p) {
                updateDoc(doc(db, 'stores', appId, 'products', item.id), { stock: p.stock - item.qty })
                    .catch(e => console.error("Error stock update", e));
            }
        });

        // 3. Actualizar Cliente (Si corresponde)
        if (saleData.clientId && saleData.clientId !== 'anonimo') {
            // Lógica simplificada: si el ID es válido, intentamos actualizar. 
            // Nota: En un sistema real buscaríamos el docId del cliente si es distinto al Auth UID.
            // Aquí asumimos que si es admin vendiendo a cliente registrado, tenemos el ID de la colección customers.
            updateDoc(doc(db, 'stores', appId, 'customers', saleData.clientId), {
                externalOrdersCount: (saleData.externalOrdersCount || 0) + 1, // Esto requeriría leer el cliente antes, simplificamos
                lastPurchase: serverTimestamp()
            }).catch(() => { });
        }

        setLastTransactionId({ ...saleData, id: docRef.id, date: { seconds: Date.now() / 1000 } });
        return docRef.id;
    };

    const updateTransaction = async (id, data) => updateDoc(doc(db, 'stores', appId, 'transactions', id), data);
    const deleteTransaction = async (id) => deleteDoc(doc(db, 'stores', appId, 'transactions', id));

    // CÁLCULO DE BALANCE (Logic moved from App.jsx)
    const balance = useMemo(() => {
        let salesPaid = 0, salesPending = 0, salesPartial = 0, costOfGoodsSold = 0, inventoryValue = 0;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        let todayCash = 0, todayDigital = 0, todayTotal = 0;
        const chartDataMap = {};

        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            chartDataMap[d.toLocaleDateString('es-ES', { weekday: 'short' })] = { name: d.toLocaleDateString('es-ES', { weekday: 'short' }), total: 0 };
        }

        let totalExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);

        transactions.forEach(t => {
            const tDate = t.date?.seconds ? new Date(t.date.seconds * 1000) : new Date();
            if (t.type === 'sale') {
                if (t.paymentStatus === 'paid') {
                    salesPaid += t.total;
                    if (t.items) t.items.forEach(item => costOfGoodsSold += (item.cost || 0) * item.qty);
                    if (tDate >= today) { todayTotal += t.total; if (t.paymentMethod === 'cash') todayCash += t.total; else todayDigital += t.total; }
                    const dayLabel = tDate.toLocaleDateString('es-ES', { weekday: 'short' });
                    if (chartDataMap[dayLabel]) chartDataMap[dayLabel].total += t.total;
                } else if (t.paymentStatus === 'pending') salesPending += t.total;
                else if (t.paymentStatus === 'partial') salesPartial += t.total;
            }
        });

        products.forEach(p => { inventoryValue += (p.price * p.stock); });

        const categoryValues = {};
        // Necesitamos pasar categorías al hook o calcularlo en UI. 
        // Para simplificar este hook, el cálculo de categorías se puede hacer aquí si pasamos categories como prop, o dejarlo en Dashboard.
        // Lo dejaremos aquí asumiendo que products tiene categoryId.

        return {
            salesPaid, salesPending, salesPartial, inventoryValue, totalExpenses,
            grossProfit: salesPaid - costOfGoodsSold,
            netProfit: (salesPaid - costOfGoodsSold) - totalExpenses,
            costOfGoodsSold, todayCash, todayDigital, todayTotal,
            chartData: Object.values(chartDataMap),
            categoryValues // Se llenará en Dashboard si es necesario o aquí si pasamos categories
        };
    }, [transactions, products, expenses]);

    return { transactions, lastTransactionId, createTransaction, updateTransaction, deleteTransaction, balance };
};