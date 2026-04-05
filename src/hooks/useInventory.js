import { useState, useEffect } from 'react';
import {
    collection, query, orderBy, limit, onSnapshot,
    addDoc, updateDoc, deleteDoc, doc, setDoc, serverTimestamp,
    writeBatch, increment
} from 'firebase/firestore';
import { db, appId } from '../config/firebase';

export const useInventory = (user, userData) => {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [storeProfile, setStoreProfile] = useState({ name: 'MiNegocio', logoUrl: '' });

    useEffect(() => {
        if (!user) return;
        const unsubProfile = onSnapshot(doc(db, 'stores', appId, 'settings', 'profile'), (d) => {
            if (d.exists()) setStoreProfile(d.data());
        });
        const unsubProducts = onSnapshot(query(collection(db, 'stores', appId, 'products'), orderBy('name'), limit(1000)), (s) =>
            // Filtramos productos soft-deleted (isActive: false).
            // Productos existentes sin el campo isActive se consideran activos (isActive !== false).
            setProducts(s.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.isActive !== false))
        );
        const unsubCats = onSnapshot(query(collection(db, 'stores', appId, 'categories'), orderBy('name')), (s) =>
            setCategories(s.docs.map(d => ({ id: d.id, ...d.data() })))
        );
        const unsubSubCats = onSnapshot(query(collection(db, 'stores', appId, 'subcategories'), orderBy('name')), (s) =>
            setSubcategories(s.docs.map(d => ({ id: d.id, ...d.data() })))
        );
        return () => {
            unsubProfile(); unsubProducts(); unsubCats(); unsubSubCats();
        };
    }, [user]);

    useEffect(() => {
        if (!user) return;
        let unsubCustomers = () => { };
        let unsubExpenses = () => { };
        if (userData?.role === 'admin') {
            // ✅ Límites razonables: 500 clientes y 300 gastos recientes.
            // Suficiente para cualquier tienda mediana sin abusar de lecturas de Firestore.
            unsubCustomers = onSnapshot(
                query(collection(db, 'stores', appId, 'customers'), orderBy('name'), limit(500)),
                (s) => setCustomers(s.docs.map(d => ({ id: d.id, ...d.data() })))
            );
            unsubExpenses = onSnapshot(
                query(collection(db, 'stores', appId, 'expenses'), orderBy('date', 'desc'), limit(300)),
                (s) => setExpenses(s.docs.map(d => ({ id: d.id, ...d.data() })))
            );
        } else {
            setCustomers([]); setExpenses([]);
        }
        return () => { unsubCustomers(); unsubExpenses(); };
    }, [user, userData?.role]);

    // --- NUEVA ACCIÓN: REGISTRO DE FALLAS ---
    const registerFaultyProduct = async (product, qty, reason) => {
        if (!product || !qty) return;
        const batch = writeBatch(db);
        const productRef = doc(db, 'stores', appId, 'products', product.id);
        const expenseRef = doc(collection(db, 'stores', appId, 'expenses'));

        // 1. Restamos del stock físico
        batch.update(productRef, {
            stock: increment(-qty)
        });

        // 2. Registramos la pérdida como gasto basado en el costo del producto
        const lossAmount = (product.cost || 0) * qty;
        batch.set(expenseRef, {
            description: `PÉRDIDA (Fallado): ${qty}x ${product.name} - ${reason || 'Sin motivo'}`,
            amount: lossAmount,
            date: serverTimestamp(),
            type: 'inventory_loss',
            productId: product.id
        });

        await batch.commit();
    };

    const addProduct = async (data) => addDoc(collection(db, 'stores', appId, 'products'), { ...data, isActive: true, createdAt: serverTimestamp() });
    const updateProduct = async (id, data) => updateDoc(doc(db, 'stores', appId, 'products', id), data);

    /**
     * bulkUpdatePrices
     * Actualiza precio y/o costo de todos los productos de una categoría en un batch atómico.
     *
     * @param {string}  categoryId   — ID de la categoría ('__all__' = todas)
     * @param {object}  priceConfig  — { type: 'percent'|'fixed', value: number, field: 'price'|'cost'|'both', roundTo: number }
     *   type:    'percent' → sube/baja X% | 'fixed' → suma/resta monto fijo
     *   value:   número (puede ser negativo para bajar)
     *   field:   qué campo afectar ('price', 'cost', 'both')
     *   roundTo: redondear al múltiplo más cercano (ej: 10 → $4.745 → $4.750). 0 = sin redondeo.
     * @returns {{ updated: number }}  cantidad de productos actualizados
     */
    const bulkUpdatePrices = async (categoryId, priceConfig) => {
        const { type, value, field, roundTo = 0 } = priceConfig;

        // Selección: '__all__' | categoryId | '__sub__:subcategoryId'
        const targets = categoryId === '__all__'
            ? products
            : categoryId.startsWith('__sub__:')
                ? products.filter(p => p.subCategoryId === categoryId.slice(8))
                : products.filter(p => p.categoryId === categoryId);

        if (targets.length === 0) return { updated: 0 };

        const round = (n) => {
            if (!roundTo || roundTo <= 0) return Math.round(n);
            return Math.round(n / roundTo) * roundTo;
        };

        const applyChange = (current) => {
            const base = Number(current || 0);
            const next = type === 'percent'
                ? base * (1 + value / 100)
                : base + value;
            return round(Math.max(0, next)); // nunca negativo
        };

        // Firestore: máximo 500 ops por batch → chunking de 450
        const CHUNK = 450;
        let updated = 0;

        for (let i = 0; i < targets.length; i += CHUNK) {
            const chunk = targets.slice(i, i + CHUNK);
            const batch = writeBatch(db);

            chunk.forEach(p => {
                const ref = doc(db, 'stores', appId, 'products', p.id);
                const payload = {};
                if (field === 'price' || field === 'both') payload.price = applyChange(p.price);
                if (field === 'cost'  || field === 'both') payload.cost  = applyChange(p.cost);
                batch.update(ref, payload);
                updated++;
            });

            await batch.commit();
        }

        return { updated };
    };
    // Soft delete: marca el producto como inactivo en lugar de borrarlo físicamente.
    // Preserva el historial de ventas que referencia el producto por ID.
    const deleteProduct = async (id) => updateDoc(
        doc(db, 'stores', appId, 'products', id),
        { isActive: false, deletedAt: serverTimestamp() }
    );

    const addStock = async (product, qty) => {
        if (!product || !qty) return;
        // ✅ FIX: usar increment() atómico en lugar de product.stock + qty
        // para evitar race conditions cuando múltiples sesiones actualizan stock simultáneamente.
        await updateDoc(doc(db, 'stores', appId, 'products', product.id), { stock: increment(qty) });
    };

    const addCategory = async (name) => addDoc(collection(db, 'stores', appId, 'categories'), { name, isActive: true, createdAt: serverTimestamp() });
    const updateCategory = async (id, data) => updateDoc(doc(db, 'stores', appId, 'categories', id), data);
    const deleteCategory = async (id) => deleteDoc(doc(db, 'stores', appId, 'categories', id));
    const addSubCategory = async (parentId, name) => addDoc(collection(db, 'stores', appId, 'subcategories'), { parentId, name, createdAt: serverTimestamp() });
    const deleteSubCategory = async (id) => deleteDoc(doc(db, 'stores', appId, 'subcategories', id));
    const addCustomer = async (data) => addDoc(collection(db, 'stores', appId, 'customers'), { ...data, createdAt: serverTimestamp() });
    const updateCustomer = async (id, data) => updateDoc(doc(db, 'stores', appId, 'customers', id), data);
    const deleteCustomer = async (id) => deleteDoc(doc(db, 'stores', appId, 'customers', id));
    const addExpense = async (data) => addDoc(collection(db, 'stores', appId, 'expenses'), { ...data, date: serverTimestamp() });
    const deleteExpense = async (id) => deleteDoc(doc(db, 'stores', appId, 'expenses', id));
    const updateStoreProfile = async (data) => setDoc(doc(db, 'stores', appId, 'settings', 'profile'), data, { merge: true });
    const generateInvitationCode = async () => {
        // substring(2, 10) → 8 caracteres (base36 sin el "0." inicial)
        const code = Math.random().toString(36).substring(2, 10).toUpperCase();
        await addDoc(collection(db, 'stores', appId, 'invitation_codes'), { code, status: 'active', createdAt: serverTimestamp() });
        return code;
    };

    return {
        products, categories, subcategories, customers, expenses, storeProfile,
        addProduct, updateProduct, deleteProduct, addStock, registerFaultyProduct, bulkUpdatePrices,
        addCategory, updateCategory, deleteCategory,
        addSubCategory, deleteSubCategory,
        addCustomer, updateCustomer, deleteCustomer,
        addExpense, deleteExpense,
        updateStoreProfile, generateInvitationCode
    };
};