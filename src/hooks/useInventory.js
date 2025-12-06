import { useState, useEffect } from 'react';
import {
    collection, query, orderBy, onSnapshot,
    addDoc, updateDoc, deleteDoc, doc, setDoc, serverTimestamp, writeBatch, getDocs, where
} from 'firebase/firestore';
import { db, appId } from '../config/firebase';

export const useInventory = (user) => {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [storeProfile, setStoreProfile] = useState({ name: 'MiNegocio', logoUrl: '' });

    useEffect(() => {
        if (!user) return;

        const unsubProfile = onSnapshot(doc(db, 'stores', appId, 'settings', 'profile'), (d) => {
            if (d.exists()) setStoreProfile(d.data());
        });

        const unsubProducts = onSnapshot(query(collection(db, 'stores', appId, 'products'), orderBy('name')), (s) =>
            setProducts(s.docs.map(d => ({ id: d.id, ...d.data() })))
        );

        const unsubCats = onSnapshot(query(collection(db, 'stores', appId, 'categories'), orderBy('name')), (s) =>
            setCategories(s.docs.map(d => ({ id: d.id, ...d.data() })))
        );

        const unsubCustomers = onSnapshot(query(collection(db, 'stores', appId, 'customers'), orderBy('name')), (s) =>
            setCustomers(s.docs.map(d => ({ id: d.id, ...d.data() })))
        );

        const unsubExpenses = onSnapshot(query(collection(db, 'stores', appId, 'expenses'), orderBy('date', 'desc')), (s) =>
            setExpenses(s.docs.map(d => ({ id: d.id, ...d.data() })))
        );

        return () => {
            unsubProfile(); unsubProducts(); unsubCats(); unsubCustomers(); unsubExpenses();
        };
    }, [user]);

    // --- ACCIONES INDIVIDUALES ---
    const addProduct = async (data) => addDoc(collection(db, 'stores', appId, 'products'), { ...data, createdAt: serverTimestamp() });
    const updateProduct = async (id, data) => updateDoc(doc(db, 'stores', appId, 'products', id), data);
    const deleteProduct = async (id) => deleteDoc(doc(db, 'stores', appId, 'products', id));

    const addStock = async (product, qty) => {
        if (!product || !qty) return;
        await updateDoc(doc(db, 'stores', appId, 'products', product.id), { stock: product.stock + qty });
    };

    const addCategory = async (name) => addDoc(collection(db, 'stores', appId, 'categories'), { name, createdAt: serverTimestamp() });
    const deleteCategory = async (id) => deleteDoc(doc(db, 'stores', appId, 'categories', id));

    const addCustomer = async (data) => addDoc(collection(db, 'stores', appId, 'customers'), { ...data, createdAt: serverTimestamp() });
    const updateCustomer = async (id, data) => updateDoc(doc(db, 'stores', appId, 'customers', id), data);
    const deleteCustomer = async (id) => deleteDoc(doc(db, 'stores', appId, 'customers', id));

    const addExpense = async (data) => addDoc(collection(db, 'stores', appId, 'expenses'), { ...data, date: serverTimestamp() });
    const deleteExpense = async (id) => deleteDoc(doc(db, 'stores', appId, 'expenses', id));

    const updateStoreProfile = async (data) => setDoc(doc(db, 'stores', appId, 'settings', 'profile'), data);

    const generateInvitationCode = async () => {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        await addDoc(collection(db, 'stores', appId, 'invitation_codes'), { code, status: 'active', createdAt: serverTimestamp() });
        return code;
    };

    // --- NUEVO: IMPORTACIÓN MASIVA ---
    const importBatch = async (jsonData) => {
        const batch = writeBatch(db);
        const timestamp = new Date();

        // 1. Obtener categorías actuales para no duplicar
        const catsSnapshot = await getDocs(collection(db, 'stores', appId, 'categories'));
        const existingCats = {};
        catsSnapshot.forEach(doc => existingCats[doc.data().name.toLowerCase()] = doc.id);

        // 2. Procesar cada producto
        for (const item of jsonData) {
            let catId = 'uncategorized';
            const catName = item.category || 'General';

            // Buscar o Crear Categoría en memoria (Nota: en un caso real idealmente crearíamos las cats antes)
            // Para simplificar, si la categoría no existe en el mapa local, generamos un ID nuevo
            if (existingCats[catName.toLowerCase()]) {
                catId = existingCats[catName.toLowerCase()];
            } else {
                const newCatRef = doc(collection(db, 'stores', appId, 'categories'));
                batch.set(newCatRef, { name: catName, createdAt: timestamp });
                existingCats[catName.toLowerCase()] = newCatRef.id; // Guardar para reusar
                catId = newCatRef.id;
            }

            const prodRef = doc(collection(db, 'stores', appId, 'products'));
            batch.set(prodRef, {
                name: item.name,
                price: parseFloat(item.price) || 0,
                cost: parseFloat(item.cost) || 0,
                barcode: item.barcode || '',
                stock: parseInt(item.stock) || 0,
                imageUrl: item.imageUrl || '',
                categoryId: catId,
                createdAt: timestamp
            });
        }

        await batch.commit();
    };

    return {
        products, categories, customers, expenses, storeProfile,
        addProduct, updateProduct, deleteProduct, addStock,
        addCategory, deleteCategory,
        addCustomer, updateCustomer, deleteCustomer,
        addExpense, deleteExpense,
        updateStoreProfile, generateInvitationCode,
        importBatch // <--- Exportamos la nueva función
    };
};