import { useState, useEffect } from 'react';
import {
    collection, query, orderBy, onSnapshot,
    addDoc, updateDoc, deleteDoc, doc, setDoc, serverTimestamp
} from 'firebase/firestore';
import { db, appId } from '../config/firebase';

export const useInventory = (user, userData) => {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [storeProfile, setStoreProfile] = useState({ name: 'MiNegocio', logoUrl: '' });

    // --- EFECTO 1: DATOS PÚBLICOS (Productos, Categorías, Perfil) ---
    // Este efecto SOLO depende de 'user'. No se reinicia cuando carga el userData.
    useEffect(() => {
        if (!user) return;

        console.log("📦 Iniciando suscripción a Inventario (Público)...");

        // 1. Perfil
        const unsubProfile = onSnapshot(doc(db, 'stores', appId, 'settings', 'profile'), (d) => {
            if (d.exists()) setStoreProfile(d.data());
        });

        // 2. Productos (La carga pesada)
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

        return () => {
            console.log("🛑 Limpiando suscripción pública...");
            unsubProfile();
            unsubProducts();
            unsubCats();
            unsubSubCats();
        };
    }, [user]); // <--- ¡CLAVE! Quitamos userData de aquí para evitar recargas dobles.


    // --- EFECTO 2: DATOS PRIVADOS (Clientes, Gastos) ---
    // Este efecto SÍ depende del rol. Se activa después, sin molestar al inventario.
    useEffect(() => {
        if (!user) return;

        let unsubCustomers = () => { };
        let unsubExpenses = () => { };

        // Solo si es admin activamos este carril
        if (userData?.role === 'admin') {
            console.log("🔐 Rol Admin confirmado: Cargando datos sensibles...");

            unsubCustomers = onSnapshot(query(collection(db, 'stores', appId, 'customers'), orderBy('name')), (s) =>
                setCustomers(s.docs.map(d => ({ id: d.id, ...d.data() })))
            );

            unsubExpenses = onSnapshot(query(collection(db, 'stores', appId, 'expenses'), orderBy('date', 'desc')), (s) =>
                setExpenses(s.docs.map(d => ({ id: d.id, ...d.data() })))
            );
        } else {
            // Si no es admin, aseguramos que estos arrays estén vacíos
            setCustomers([]);
            setExpenses([]);
        }

        return () => {
            unsubCustomers();
            unsubExpenses();
        };
    }, [user, userData?.role]); // <--- Solo reacciona si cambia el ROL, no todo el objeto userData

    // --- ACTIONS ---
    const addProduct = async (data) => addDoc(collection(db, 'stores', appId, 'products'), { ...data, createdAt: serverTimestamp() });
    const updateProduct = async (id, data) => updateDoc(doc(db, 'stores', appId, 'products', id), data);
    const deleteProduct = async (id) => deleteDoc(doc(db, 'stores', appId, 'products', id));

    const addStock = async (product, qty) => {
        if (!product || !qty) return;
        await updateDoc(doc(db, 'stores', appId, 'products', product.id), { stock: product.stock + qty });
    };

    const addCategory = async (name) => addDoc(collection(db, 'stores', appId, 'categories'), {
        name,
        isActive: true,
        createdAt: serverTimestamp()
    });

    const updateCategory = async (id, data) => updateDoc(doc(db, 'stores', appId, 'categories', id), data);
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
        addCategory, updateCategory, deleteCategory,
        addSubCategory, deleteSubCategory,
        addCustomer, updateCustomer, deleteCustomer,
        addExpense, deleteExpense,
        updateStoreProfile, generateInvitationCode
    };
};