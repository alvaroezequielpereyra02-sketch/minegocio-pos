import { useState, useEffect } from 'react';
import {
    collection, query, orderBy, onSnapshot,
    addDoc, updateDoc, deleteDoc, doc, setDoc, serverTimestamp
} from 'firebase/firestore';
import { db, appId } from '../config/firebase';

export const useInventory = (user) => {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState([]); // <--- NUEVO
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

        // --- 1. ESCUCHAR SUBCATEGORÍAS ---
        const unsubSubCats = onSnapshot(query(collection(db, 'stores', appId, 'subcategories'), orderBy('name')), (s) =>
            setSubcategories(s.docs.map(d => ({ id: d.id, ...d.data() })))
        );

        const unsubCustomers = onSnapshot(query(collection(db, 'stores', appId, 'customers'), orderBy('name')), (s) =>
            setCustomers(s.docs.map(d => ({ id: d.id, ...d.data() })))
        );

        const unsubExpenses = onSnapshot(query(collection(db, 'stores', appId, 'expenses'), orderBy('date', 'desc')), (s) =>
            setExpenses(s.docs.map(d => ({ id: d.id, ...d.data() })))
        );

        return () => {
            unsubProfile(); unsubProducts(); unsubCats(); unsubSubCats(); unsubCustomers(); unsubExpenses();
        };
    }, [user]);

    // --- ACTIONS ---

    const addProduct = async (data) => addDoc(collection(db, 'stores', appId, 'products'), { ...data, createdAt: serverTimestamp() });
    const updateProduct = async (id, data) => updateDoc(doc(db, 'stores', appId, 'products', id), data);
    const deleteProduct = async (id) => deleteDoc(doc(db, 'stores', appId, 'products', id));

    const addStock = async (product, qty) => {
        if (!product || !qty) return;
        await updateDoc(doc(db, 'stores', appId, 'products', product.id), { stock: product.stock + qty });
    };

    const addCategory = async (name) => addDoc(collection(db, 'stores', appId, 'categories'), { name, createdAt: serverTimestamp() });
    const deleteCategory = async (id) => deleteDoc(doc(db, 'stores', appId, 'categories', id));

    // --- 2. ACCIONES SUBCATEGORÍAS ---
    // Guardamos el ID de la categoría padre (parentId)
    const addSubCategory = async (parentId, name) =>
        addDoc(collection(db, 'stores', appId, 'subcategories'), { parentId, name, createdAt: serverTimestamp() });

    const deleteSubCategory = async (id) => deleteDoc(doc(db, 'stores', appId, 'subcategories', id));

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

    return {
        products, categories, subcategories, customers, expenses, storeProfile, // Exportamos subcategories
        addProduct, updateProduct, deleteProduct, addStock,
        addCategory, deleteCategory,
        addSubCategory, deleteSubCategory, // Exportamos acciones
        addCustomer, updateCustomer, deleteCustomer,
        addExpense, deleteExpense,
        updateStoreProfile, generateInvitationCode
    };
};