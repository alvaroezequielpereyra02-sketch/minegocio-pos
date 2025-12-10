import { useState, useEffect } from 'react';
import {
    collection, query, orderBy, onSnapshot,
    addDoc, updateDoc, deleteDoc, doc, setDoc, serverTimestamp
} from 'firebase/firestore';
import { db, appId } from '../config/firebase';

// 1. Aceptamos 'userData' como segundo parámetro
export const useInventory = (user, userData) => {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [storeProfile, setStoreProfile] = useState({ name: 'MiNegocio', logoUrl: '' });

    useEffect(() => {
        if (!user) return;

        // --- A. DATOS PÚBLICOS O GENERALES (Todos pueden verlos) ---

        // 1. Perfil de la tienda
        const unsubProfile = onSnapshot(doc(db, 'stores', appId, 'settings', 'profile'), (d) => {
            if (d.exists()) setStoreProfile(d.data());
        });

        // 2. Productos
        const unsubProducts = onSnapshot(query(collection(db, 'stores', appId, 'products'), orderBy('name')), (s) =>
            setProducts(s.docs.map(d => ({ id: d.id, ...d.data() })))
        );

        // 3. Categorías
        const unsubCats = onSnapshot(query(collection(db, 'stores', appId, 'categories'), orderBy('name')), (s) =>
            setCategories(s.docs.map(d => ({ id: d.id, ...d.data() })))
        );

        // 4. Subcategorías
        const unsubSubCats = onSnapshot(query(collection(db, 'stores', appId, 'subcategories'), orderBy('name')), (s) =>
            setSubcategories(s.docs.map(d => ({ id: d.id, ...d.data() })))
        );

        // --- B. DATOS PRIVADOS (Solo si es Admin) ---
        // Definimos funciones vacías por defecto para evitar errores al limpiar
        let unsubCustomers = () => { };
        let unsubExpenses = () => { };

        // Verificamos el rol antes de suscribirnos
        if (userData?.role === 'admin') {
            console.log("🔐 Rol Admin detectado: Cargando datos privados...");

            unsubCustomers = onSnapshot(query(collection(db, 'stores', appId, 'customers'), orderBy('name')), (s) =>
                setCustomers(s.docs.map(d => ({ id: d.id, ...d.data() })))
            );

            unsubExpenses = onSnapshot(query(collection(db, 'stores', appId, 'expenses'), orderBy('date', 'desc')), (s) =>
                setExpenses(s.docs.map(d => ({ id: d.id, ...d.data() })))
            );
        } else {
            // Si deja de ser admin (o es cliente), limpiamos estos datos por seguridad
            setCustomers([]);
            setExpenses([]);
        }

        // Limpieza al desmontar
        return () => {
            unsubProfile();
            unsubProducts();
            unsubCats();
            unsubSubCats();
            unsubCustomers(); // Se ejecuta si fue asignada
            unsubExpenses();  // Se ejecuta si fue asignada
        };

    }, [user, userData]); // <--- IMPORTANTE: Se ejecuta de nuevo si cambia el usuario o sus datos (rol)

    // --- ACTIONS (Funciones de escritura) ---

    const addProduct = async (data) => addDoc(collection(db, 'stores', appId, 'products'), { ...data, createdAt: serverTimestamp() });
    const updateProduct = async (id, data) => updateDoc(doc(db, 'stores', appId, 'products', id), data);
    const deleteProduct = async (id) => deleteDoc(doc(db, 'stores', appId, 'products', id));

    const addStock = async (product, qty) => {
        if (!product || !qty) return;
        await updateDoc(doc(db, 'stores', appId, 'products', product.id), { stock: product.stock + qty });
    };

    const addCategory = async (name) => addDoc(collection(db, 'stores', appId, 'categories'), { name, createdAt: serverTimestamp() });
    const deleteCategory = async (id) => deleteDoc(doc(db, 'stores', appId, 'categories', id));

    const addSubCategory = async (parentId, name) =>
        addDoc(collection(db, 'stores', appId, 'subcategories'), { parentId, name, createdAt: serverTimestamp() });

    const deleteSubCategory = async (id) => deleteDoc(doc(db, 'stores', appId, 'subcategories', id));

    const addCustomer = async (data) => addDoc(collection(db, 'stores', appId, 'customers'), { ...data, createdAt: serverTimestamp() });
    const updateCustomer = async (id, data) => updateDoc(doc(db, 'stores', appId, 'customers', id), data);
    const deleteCustomer = async (id) => deleteDoc(doc(db, 'stores', appId, 'customers', id));

    const addExpense = async (data) => addDoc(collection(db, 'stores', appId, 'expenses'), { ...data, date: serverTimestamp() });
    const deleteExpense = async (id) => deleteDoc(doc(db, 'stores', appId, 'expenses', id));

    const updateStoreProfile = async (data) =>
        setDoc(doc(db, 'stores', appId, 'settings', 'profile'), data, { merge: true });

    const generateInvitationCode = async () => {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        await addDoc(collection(db, 'stores', appId, 'invitation_codes'), { code, status: 'active', createdAt: serverTimestamp() });
        return code;
    };

    return {
        products, categories, subcategories, customers, expenses, storeProfile,
        addProduct, updateProduct, deleteProduct, addStock,
        addCategory, deleteCategory,
        addSubCategory, deleteSubCategory,
        addCustomer, updateCustomer, deleteCustomer,
        addExpense, deleteExpense,
        updateStoreProfile, generateInvitationCode
    };
};