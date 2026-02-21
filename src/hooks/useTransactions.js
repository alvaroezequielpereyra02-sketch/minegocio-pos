import { useState, useEffect, useMemo } from 'react';
import {
    collection, query, orderBy, limit, where, onSnapshot, Timestamp,
    updateDoc, doc, serverTimestamp, writeBatch, getDoc, increment
} from 'firebase/firestore';
import { db, appId } from '../config/firebase';

export const useTransactions = (user, userData, products = [], expenses = [], categories = [], dateRange = 'week') => {
    const [transactions, setTransactions] = useState([]);
    const [lastTransactionId, setLastTransactionId] = useState(null);

    // 1. Cargar Transacciones
    // ✅ Filtramos por fecha en Firestore en lugar de traer 5000 docs y filtrar en cliente.
    // Traemos 35 días siempre (5 días de margen sobre el máximo de 30 días del balance),
    // más un límite de 500 como techo de seguridad para tiendas con mucho volumen.
    useEffect(() => {
        if (!user || !userData) return;

        let q;
        if (userData.role === 'admin') {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 35);
            q = query(
                collection(db, 'stores', appId, 'transactions'),
                where('date', '>=', Timestamp.fromDate(cutoff)),
                orderBy('date', 'desc'),
                limit(500)
            );
        } else {
            q = query(
                collection(db, 'stores', appId, 'transactions'),
                where('clientId', '==', user.uid),
                orderBy('date', 'desc'),
                limit(50)
            );
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => unsubscribe();
    }, [user, userData]);

    // 2. Crear Transacción (Venta)
    // 2. Crear Transacción (Venta)
    const createTransaction = async (saleData, cartItems) => {
        // 🛡️ LIMPIEZA: Eliminamos campos 'undefined' para evitar errores de Firebase
        const cleanSaleData = Object.fromEntries(
            Object.entries(saleData).filter(([_, value]) => value !== undefined)
        );

        const batch = writeBatch(db);

        // A) Crear el documento de venta
        const transactionRef = doc(collection(db, 'stores', appId, 'transactions'));
        batch.set(transactionRef, cleanSaleData);

        // B) Descontar Stock (Atómico)
        cartItems.forEach(item => {
            const productRef = doc(db, 'stores', appId, 'products', item.id);
            batch.update(productRef, { stock: increment(-item.qty) });
        });

        // C) Actualizar o CREAR cliente (si corresponde)
        if (cleanSaleData.clientId && cleanSaleData.clientId !== 'anonimo') {
            const customerRef = doc(db, 'stores', appId, 'customers', cleanSaleData.clientId);

            // 🔄 CAMBIO CLAVE: Usamos set con { merge: true } en lugar de update
            batch.set(customerRef, {
                name: cleanSaleData.clientName || 'Cliente',
                email: user?.email || '',
                externalOrdersCount: increment(1),
                lastPurchase: serverTimestamp()
            }, { merge: true }); // <--- Esto evita el error "No document to update"
        }

        await batch.commit();

        const fullTransaction = {
            ...cleanSaleData,
            id: transactionRef.id,
            date: { seconds: Date.now() / 1000 }
        };

        setLastTransactionId(fullTransaction);
        return fullTransaction;
    };

    // 3. Actualizar Transacción (¡CON AJUSTE DE STOCK INTELIGENTE!)
    const updateTransaction = async (id, data) => {
        // 🛡️ LIMPIEZA: Eliminamos campos 'undefined' para evitar errores de Firebase
        const cleanData = Object.fromEntries(
            Object.entries(data).filter(([_, value]) => value !== undefined)
        );

        // ESCUDO DE SEGURIDAD: Evita la sobrescritura con ceros o boletas vacías
        if (cleanData.items && cleanData.items.length === 0 && cleanData.total === 0) {
            console.error("Bloqueo preventivo: Se intentó guardar una boleta vacía.");
            return;
        }

        const transactionRef = doc(db, 'stores', appId, 'transactions', id);

        // Si solo actualizamos campos simples (como el estado de pago o status de reparto)
        if (!cleanData.items) {
            await updateDoc(transactionRef, cleanData);
            return;
        }

        const batch = writeBatch(db);

        // 1. Obtener la transacción original antes de modificarla
        const oldTransactionSnap = await getDoc(transactionRef);
        if (!oldTransactionSnap.exists()) throw new Error("La transacción no existe.");

        const oldItems = oldTransactionSnap.data().items || [];
        const newItems = cleanData.items;

        // 2. Revertir el stock (devolver lo viejo a la estantería)
        oldItems.forEach(item => {
            const productRef = doc(db, 'stores', appId, 'products', item.id);
            batch.update(productRef, { stock: increment(item.qty) });
        });

        // 3. Aplicar el nuevo stock (restar lo nuevo)
        newItems.forEach(item => {
            const productRef = doc(db, 'stores', appId, 'products', item.id);
            batch.update(productRef, { stock: increment(-item.qty) });
        });

        // 4. Guardar los cambios finales en el documento (usando cleanData)
        batch.update(transactionRef, cleanData);

        await batch.commit();
    };

    // 4. Borrar Transacción
    const deleteTransaction = async (id) => {
        const batch = writeBatch(db);
        const transactionRef = doc(db, 'stores', appId, 'transactions', id);

        const transactionSnap = await getDoc(transactionRef);
        if (!transactionSnap.exists()) return;

        const transactionData = transactionSnap.data();

        if (transactionData.type === 'sale' && transactionData.items) {
            transactionData.items.forEach(item => {
                const productRef = doc(db, 'stores', appId, 'products', item.id);
                batch.update(productRef, { stock: increment(item.qty) });
            });
        }

        batch.delete(transactionRef);
        await batch.commit();
    };

    const purgeTransactions = async () => {
        const batch = writeBatch(db);
        transactions.forEach(t => {
            const ref = doc(db, 'stores', appId, 'transactions', t.id);
            batch.delete(ref);
        });
        await batch.commit();
    };

    // 5. CÁLCULO DE BALANCE (CON CORRECCIÓN PARA 30 DÍAS Y NÚMEROS SEGUROS)
    const balance = useMemo(() => {
        let salesPaid = 0, salesPending = 0, salesPartial = 0, costOfGoodsSold = 0, inventoryValue = 0;
        const now = new Date();
        const startDate = new Date();

        // 🛡️ CORRECCIÓN: Aceptamos múltiples etiquetas para el rango de 30 días
        const isMonth = dateRange === 'month' || dateRange === '30' || dateRange === '30days';
        const daysToSubtract = isMonth ? 30 : 7;

        startDate.setDate(now.getDate() - daysToSubtract);
        startDate.setHours(0, 0, 0, 0);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let todayCash = 0, todayDigital = 0, todayTotal = 0;
        const chartDataMap = {};

        // Inicializamos el mapa con ceros para el rango seleccionado
        for (let i = daysToSubtract - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
            chartDataMap[key] = { name: key, total: 0 };
        }

        const categoryStats = {};
        let filteredExpenses = 0;

        // Valor de inventario (Seguro contra undefined)
        products.forEach(p => {
            inventoryValue += (Number(p.price || 0) * Number(p.stock || 0));
        });

        // Gastos del periodo (Seguro contra undefined)
        expenses.forEach(e => {
            const eDate = e.date?.seconds ? new Date(e.date.seconds * 1000) : new Date();
            if (eDate >= startDate) filteredExpenses += Number(e.amount || 0);
        });

        transactions.forEach(t => {
            const tDate = t.date?.seconds ? new Date(t.date.seconds * 1000) : new Date();
            const isWithinRange = tDate >= startDate;

            if (t.type === 'sale') {
                const currentTotal = Number(t.total || 0);
                const currentPaid = Number(t.amountPaid || 0);

                if (t.paymentStatus === 'paid') salesPaid += currentTotal;
                else if (t.paymentStatus === 'partial') {
                    salesPartial += currentPaid;
                    salesPaid += currentPaid;
                }
                else if (t.paymentStatus === 'pending') salesPending += currentTotal;

                if (tDate >= today) {
                    const amountToday = t.paymentStatus === 'paid' ? currentTotal : currentPaid;
                    todayTotal += amountToday;
                    if (t.paymentMethod === 'cash') todayCash += amountToday;
                    else todayDigital += amountToday;
                }

                if (isWithinRange && (t.paymentStatus === 'paid' || t.paymentStatus === 'partial')) {
                    const amount = t.paymentStatus === 'paid' ? currentTotal : currentPaid;
                    const dayLabel = tDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });

                    if (chartDataMap[dayLabel]) chartDataMap[dayLabel].total += amount;

                    if (t.items) {
                        t.items.forEach(item => {
                            // Cálculo de COGS (Costo de Mercadería Vendida)
                            costOfGoodsSold += (Number(item.cost || 0) * Number(item.qty || 0));

                            let catName = 'Varios';
                            if (item.categoryId) {
                                const cat = categories.find(c => c.id === item.categoryId);
                                if (cat) catName = cat.name;
                            }
                            if (!categoryStats[catName]) categoryStats[catName] = 0;
                            categoryStats[catName] += (Number(item.price || 0) * Number(item.qty || 0));
                        });
                    }
                }
            }
        });

        const salesByCategory = Object.keys(categoryStats).map(key => ({
            name: key,
            value: categoryStats[key]
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
            salesByCategory
        };
    }, [transactions, products, expenses, categories, dateRange]);

    return { transactions, lastTransactionId, createTransaction, updateTransaction, deleteTransaction, purgeTransactions, balance };
};