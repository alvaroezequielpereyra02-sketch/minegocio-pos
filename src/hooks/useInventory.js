import { useState, useEffect } from 'react';
import {
    collection, query, orderBy, limit, onSnapshot,
    addDoc, updateDoc, deleteDoc, doc, setDoc, serverTimestamp,
    writeBatch, increment
} from 'firebase/firestore';
import { getDb, appId } from '../config/firebase';

export const useInventory = (user, userData) => {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [storeProfile, setStoreProfile] = useState({ name: 'MiNegocio', logoUrl: '' });

    useEffect(() => {
        if (!user) return;
        let unsubs = [];
        getDb().then(db => {
            const unsubProfile = onSnapshot(doc(db, 'stores', appId, 'settings', 'profile'), (d) => {
                if (d.exists()) setStoreProfile(d.data());
            });
            const unsubProducts = onSnapshot(query(collection(db, 'stores', appId, 'products'), orderBy('name'), limit(1000)), (s) =>
                setProducts(s.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.isActive !== false))
            );
            const unsubCats = onSnapshot(query(collection(db, 'stores', appId, 'categories'), orderBy('name')), (s) =>
                setCategories(s.docs.map(d => ({ id: d.id, ...d.data() })))
            );
            const unsubSubCats = onSnapshot(query(collection(db, 'stores', appId, 'subcategories'), orderBy('name')), (s) =>
                setSubcategories(s.docs.map(d => ({ id: d.id, ...d.data() })))
            );
            unsubs = [unsubProfile, unsubProducts, unsubCats, unsubSubCats];
        });
        return () => { unsubs.forEach(fn => fn()); };
    }, [user]);

    useEffect(() => {
        if (!user) return;
        let unsubs2 = [];
        if (userData?.role === 'admin') {
            getDb().then(db => {
                const unsubCustomers = onSnapshot(
                    query(collection(db, 'stores', appId, 'customers'), orderBy('name'), limit(500)),
                    (s) => setCustomers(s.docs.map(d => ({ id: d.id, ...d.data() })))
                );
                const unsubExpenses = onSnapshot(
                    query(collection(db, 'stores', appId, 'expenses'), orderBy('date', 'desc'), limit(300)),
                    (s) => setExpenses(s.docs.map(d => ({ id: d.id, ...d.data() })))
                );
                unsubs2 = [unsubCustomers, unsubExpenses];
            });
        } else {
            setCustomers([]); setExpenses([]);
        }
        return () => { unsubs2.forEach(fn => fn()); };
    }, [user, userData?.role]);

    // --- NUEVA ACCIÓN: REGISTRO DE FALLAS ---
    const registerFaultyProduct = async (product, qty, reason) => {
        if (!product || !qty) return;
        const db = await getDb();
        const batch = writeBatch(db);
        const productRef = doc(db, 'stores', appId, 'products', product.id);
        const expenseRef = doc(collection(db, 'stores', appId, 'expenses'));
        batch.update(productRef, { stock: increment(-qty) });
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

    const addProduct = async (data) => {
        const db = await getDb();
        return addDoc(collection(db, 'stores', appId, 'products'), { ...data, isActive: true, createdAt: serverTimestamp() });
    };
    const updateProduct = async (id, data) => {
        const db = await getDb();
        return updateDoc(doc(db, 'stores', appId, 'products', id), data);
    };

    const bulkUpdatePrices = async (categoryId, priceConfig) => {
        const { type, value, field, roundTo = 0 } = priceConfig;
        const targets = categoryId === '__all__'
            ? products
            : categoryId.startsWith('__sub__:')
                ? products.filter(p => p.subCategoryId === categoryId.slice(8))
                : products.filter(p => p.categoryId === categoryId);
        if (targets.length === 0) return { updated: 0 };
        const round = (n) => (!roundTo || roundTo <= 0) ? Math.round(n) : Math.round(n / roundTo) * roundTo;
        const applyChange = (current) => {
            const base = Number(current || 0);
            const next = type === 'percent' ? base * (1 + value / 100) : base + value;
            return round(Math.max(0, next));
        };
        const CHUNK = 450;
        let updated = 0;
        const db = await getDb();
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

    const deleteProduct = async (id) => {
        const db = await getDb();
        return updateDoc(doc(db, 'stores', appId, 'products', id), { isActive: false, deletedAt: serverTimestamp() });
    };
    const addStock = async (product, qty) => {
        if (!product || !qty) return;
        const db = await getDb();
        await updateDoc(doc(db, 'stores', appId, 'products', product.id), { stock: increment(qty) });
    };
    const addCategory = async (name) => {
        const db = await getDb();
        return addDoc(collection(db, 'stores', appId, 'categories'), { name, isActive: true, createdAt: serverTimestamp() });
    };
    const updateCategory = async (id, data) => { const db = await getDb(); return updateDoc(doc(db, 'stores', appId, 'categories', id), data); };
    const deleteCategory = async (id) => { const db = await getDb(); return deleteDoc(doc(db, 'stores', appId, 'categories', id)); };
    const addSubCategory = async (parentId, name) => { const db = await getDb(); return addDoc(collection(db, 'stores', appId, 'subcategories'), { parentId, name, createdAt: serverTimestamp() }); };
    const deleteSubCategory = async (id) => { const db = await getDb(); return deleteDoc(doc(db, 'stores', appId, 'subcategories', id)); };
    const addCustomer = async (data) => { const db = await getDb(); return addDoc(collection(db, 'stores', appId, 'customers'), { ...data, createdAt: serverTimestamp() }); };
    const updateCustomer = async (id, data) => { const db = await getDb(); return updateDoc(doc(db, 'stores', appId, 'customers', id), data); };
    const deleteCustomer = async (id) => { const db = await getDb(); return deleteDoc(doc(db, 'stores', appId, 'customers', id)); };
    const addExpense = async (data) => { const db = await getDb(); return addDoc(collection(db, 'stores', appId, 'expenses'), { ...data, date: serverTimestamp() }); };
    const deleteExpense = async (id) => { const db = await getDb(); return deleteDoc(doc(db, 'stores', appId, 'expenses', id)); };
    const updateStoreProfile = async (data) => { const db = await getDb(); return setDoc(doc(db, 'stores', appId, 'settings', 'profile'), data, { merge: true }); };
    const generateInvitationCode = async () => {
        const code = Math.random().toString(36).substring(2, 10).toUpperCase();
        const db = await getDb();
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