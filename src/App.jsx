import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, doc, getDoc, setDoc, deleteDoc, onSnapshot, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { Store, KeyRound, Plus, Phone, MapPin, Edit, Trash2, Tags, Image as ImageIcon, Box } from 'lucide-react';

// IMPORTACIÓN DE COMPONENTES
import Sidebar, { MobileNav } from './components/Sidebar';
import Cart from './components/Cart';
import ProductGrid from './components/ProductGrid';
import Dashboard from './components/Dashboard';
import History from './components/History';
import { ExpenseModal, ProductModal, CategoryModal, CustomerModal, StoreModal, AddStockModal, TransactionModal, LogoutConfirmModal } from './components/Modals';

// CONFIGURACIÓN FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyCo69kQNCYjROXTKlu9SotNuy-QeKdWXYM",
    authDomain: "minegocio-pos-e35bf.firebaseapp.com",
    projectId: "minegocio-pos-e35bf",
    storageBucket: "minegocio-pos-e35bf.firebasestorage.app",
    messagingSenderId: "613903188094",
    appId: "1:613903188094:web:2ed15b6fb6ff5be6fd582f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'tienda-principal';
const ADMIN_SECRET_CODE = 'ADMIN123';

export default function App() {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [storeProfile, setStoreProfile] = useState({ name: 'MiNegocio', logoUrl: '' });

    // Tabs y Modales
    const [activeTab, setActiveTab] = useState('pos');
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
    const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

    // Datos
    const [products, setProducts] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [categories, setCategories] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [cart, setCart] = useState([]);

    // Estado UI
    const [showMobileCart, setShowMobileCart] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(false);
    const [lastTransactionId, setLastTransactionId] = useState(null);
    const [imageMode, setImageMode] = useState('link');
    const [previewImage, setPreviewImage] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerSearch, setCustomerSearch] = useState('');
    const [barcodeInput, setBarcodeInput] = useState('');
    const [inventoryBarcodeInput, setInventoryBarcodeInput] = useState('');
    const [scannedProduct, setScannedProduct] = useState(null);
    const quantityInputRef = useRef(null);
    const [historySection, setHistorySection] = useState('menu');
    const [isRegistering, setIsRegistering] = useState(false);
    const [loginError, setLoginError] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash');

    // --- AUTH & DATA LOADING ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                if (!userDoc.exists()) {
                    await signOut(auth);
                    setUserData(null);
                    setUser(null);
                } else {
                    setUserData(userDoc.data());
                }
            } else { setUserData(null); }
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!user || !userData) return;
        const unsubProfile = onSnapshot(doc(db, 'stores', appId, 'settings', 'profile'), (doc) => {
            if (doc.exists()) setStoreProfile(doc.data()); else setStoreProfile({ name: 'Distribuidora P&P', logoUrl: '' });
        });
        const unsubProducts = onSnapshot(query(collection(db, 'stores', appId, 'products'), orderBy('name')), (snap) => setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        const unsubCats = onSnapshot(query(collection(db, 'stores', appId, 'categories'), orderBy('name')), (snap) => setCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        const unsubCustomers = onSnapshot(query(collection(db, 'stores', appId, 'customers'), orderBy('name')), (snap) => setCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        const unsubExpenses = onSnapshot(query(collection(db, 'stores', appId, 'expenses'), orderBy('date', 'desc')), (snap) => setExpenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        const unsubTrans = onSnapshot(collection(db, 'stores', appId, 'transactions'), (snapshot) => {
            let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (userData.role !== 'admin') items = items.filter(t => t.clientId === user.uid);
            items.sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));
            setTransactions(items);
        });
        return () => { unsubProfile(); unsubProducts(); unsubTrans(); unsubCats(); unsubCustomers(); unsubExpenses(); };
    }, [user, userData]);

    // --- CALCULOS FINANCIEROS ---
    const balance = useMemo(() => {
        let salesPaid = 0, salesPending = 0, salesPartial = 0, costOfGoodsSold = 0, inventoryValue = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let todayCash = 0, todayDigital = 0, todayTotal = 0;
        const chartDataMap = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const label = d.toLocaleDateString('es-ES', { weekday: 'short' });
            chartDataMap[label] = { name: label, total: 0 };
        }
        let totalExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);
        transactions.forEach(t => {
            const tDate = t.date?.seconds ? new Date(t.date.seconds * 1000) : new Date();
            if (t.type === 'sale') {
                if (t.paymentStatus === 'paid') {
                    salesPaid += t.total;
                    if (t.items) t.items.forEach(item => costOfGoodsSold += (item.cost || 0) * item.qty);
                    if (tDate >= today) {
                        todayTotal += t.total;
                        if (t.paymentMethod === 'cash') todayCash += t.total; else todayDigital += t.total;
                    }
                    const dayLabel = tDate.toLocaleDateString('es-ES', { weekday: 'short' });
                    if (chartDataMap[dayLabel]) chartDataMap[dayLabel].total += t.total;
                } else if (t.paymentStatus === 'pending') salesPending += t.total;
                else if (t.paymentStatus === 'partial') salesPartial += t.total;
            }
        });
        products.forEach(p => { inventoryValue += (p.price * p.stock); });
        const categoryValues = {};
        products.forEach(p => {
            const catName = categories.find(c => c.id === p.categoryId)?.name || 'Sin Categoría';
            if (!categoryValues[catName]) categoryValues[catName] = 0;
            categoryValues[catName] += (p.price * p.stock);
        });
        return { salesPaid, salesPending, salesPartial, inventoryValue, totalExpenses, grossProfit: salesPaid - costOfGoodsSold, netProfit: (salesPaid - costOfGoodsSold) - totalExpenses, categoryValues, costOfGoodsSold, todayCash, todayDigital, todayTotal, chartData: Object.values(chartDataMap) };
    }, [transactions, products, expenses, categories]);

    const getCustomerDebt = (customerId) => transactions.filter(t => t.clientId === customerId && t.paymentStatus === 'pending').reduce((acc, t) => acc + t.total, 0);

    // --- HANDLERS ---
    const handleLogin = async (e) => { e.preventDefault(); try { await signInWithEmailAndPassword(auth, e.target.email.value, e.target.password.value); } catch (error) { setLoginError("Credenciales incorrectas."); } };
    const handleRegister = async (e) => { e.preventDefault(); const form = e.target; try { const userCredential = await createUserWithEmailAndPassword(auth, form.email.value, form.password.value); const role = (form.secretCode?.value === ADMIN_SECRET_CODE) ? 'admin' : 'client'; const newUserData = { email: form.email.value, name: form.name.value, phone: form.phone.value, address: form.address.value, role, createdAt: serverTimestamp() }; await setDoc(doc(db, 'users', userCredential.user.uid), newUserData); if (role === 'client') await addDoc(collection(db, 'stores', appId, 'customers'), { name: form.name.value, phone: form.phone.value, address: form.address.value, email: form.email.value, createdAt: serverTimestamp() }); } catch (error) { setLoginError(error.message); } };
    const handleResetPassword = async () => { const email = document.querySelector('input[name="email"]').value; if (!email) return setLoginError("Escribe tu correo primero."); try { await sendPasswordResetEmail(auth, email); alert("Correo enviado."); setLoginError(""); } catch (error) { setLoginError("Error al enviar correo."); } };
    const handleFinalLogout = () => { signOut(auth); setCart([]); setUserData(null); setIsLogoutConfirmOpen(false); };

    // PDF & SHARE (Lazy Load)
    const handlePrintTicket = async (transaction) => {
        if (!transaction) return;
        const html2pdfModule = await import('html2pdf.js'); const html2pdf = html2pdfModule.default;
        const date = transaction.date?.seconds ? new Date(transaction.date.seconds * 1000).toLocaleString() : 'Reciente';
        const statusText = transaction.paymentStatus === 'paid' ? 'PAGADO' : transaction.paymentStatus === 'partial' ? 'PARCIAL' : 'PENDIENTE';
        const methodText = transaction.paymentMethod === 'cash' ? 'Efectivo' : transaction.paymentMethod === 'transfer' ? 'Transferencia' : 'Otro';
        const content = `<div style="font-family: sans-serif; padding: 10px; width: 100%; background-color: white; color: black;"><div style="text-align:center; margin-bottom:10px; border-bottom:1px solid #000; padding-bottom:10px;">${storeProfile.logoUrl ? `<img src="${storeProfile.logoUrl}" style="max-width:50px; max-height:50px; margin-bottom:5px; display:block; margin: 0 auto;" />` : ''}<div style="font-size:14px; font-weight:bold; margin-top:5px; text-transform:uppercase;">${storeProfile.name}</div><div style="font-size:10px; margin-top:2px;">Comprobante de Venta</div></div><div style="font-size:11px; margin-bottom:10px; line-height: 1.4;"><div><strong>Fecha:</strong> ${date}</div><div><strong>Cliente:</strong> ${transaction.clientName || 'Consumidor Final'}</div><div><strong>Pago:</strong> ${methodText}</div></div><div style="text-align:center; font-weight:bold; font-size:12px; margin-bottom:15px; border:1px solid #000; padding:5px; background-color:#f8f8f8;">ESTADO: ${statusText}</div><table style="width:100%; border-collapse: collapse; font-size:10px;"><thead><tr style="border-bottom: 2px solid #000;"><th style="text-align:left; padding: 5px 0; width:10%;">Cant</th><th style="text-align:left; padding: 5px 2px; width:50%;">Producto</th><th style="text-align:right; padding: 5px 0; width:20%;">Unit</th><th style="text-align:right; padding: 5px 0; width:20%;">Total</th></tr></thead><tbody>${transaction.items.map(i => `<tr style="border-bottom: 1px solid #ddd;"><td style="text-align:center; padding: 8px 0; vertical-align:top;">${i.qty}</td><td style="text-align:left; padding: 8px 2px; vertical-align:top; word-wrap: break-word;">${i.name}</td><td style="text-align:right; padding: 8px 0; vertical-align:top;">$${i.price}</td><td style="text-align:right; padding: 8px 0; vertical-align:top; font-weight:bold;">$${i.price * i.qty}</td></tr>`).join('')}</tbody></table><div style="margin-top:15px; border-top:2px solid #000; padding-top:10px;"><div style="display:flex; justify-content:space-between; font-size:16px; font-weight:bold;"><span>TOTAL:</span><span>$${transaction.total}</span></div></div>${transaction.paymentNote ? `<div style="margin-top:15px; font-style:italic; font-size:10px; border:1px dashed #aaa; padding:5px;">Nota: ${transaction.paymentNote}</div>` : ''}<div style="text-align:center; margin-top:25px; font-size:10px; color:#666;">¡Gracias por su compra!<br/><strong>${storeProfile.name}</strong></div></div>`;
        const element = document.createElement('div'); element.innerHTML = content;
        html2pdf().set({ margin: [0, 0, 0, 0], filename: `ticket-${transaction.id.slice(0, 5)}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: [80, 200] } }).from(element).save();
    };
    const handleShareWhatsApp = async (transaction) => {
        if (!transaction) return;
        const html2pdfModule = await import('html2pdf.js'); const html2pdf = html2pdfModule.default;
        // (Reutiliza lógica de contenido similar a PrintTicket, simplificado para el ejemplo)
        alert("Función de compartir ticket activa (requiere entorno seguro HTTPS y soporte de navegador).");
        handlePrintTicket(transaction); // Fallback visual
    };

    const handleUpdateStore = async (e) => { e.preventDefault(); const form = e.target; const finalImageUrl = imageMode === 'file' ? previewImage : (form.logoUrlLink?.value || ''); try { await setDoc(doc(db, 'stores', appId, 'settings', 'profile'), { name: form.storeName.value, logoUrl: finalImageUrl }); setIsStoreModalOpen(false); } catch (error) { alert("Error al guardar perfil"); } };
    const addToCart = (product) => { setCart(prev => { const existing = prev.find(item => item.id === product.id); return existing ? prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item) : [...prev, { ...product, qty: 1, imageUrl: product.imageUrl }]; }); };
    const updateCartQty = (id, delta) => setCart(prev => prev.map(item => item.id === id ? { ...item, qty: item.qty + delta } : item).filter(i => i.qty > 0 || i.id !== id));
    const setCartItemQty = (id, newQty) => { const qty = parseInt(newQty); if (!qty || qty < 1) return; setCart(prev => prev.map(item => item.id === id ? { ...item, qty: qty } : item)); };
    const removeFromCart = (id) => setCart(prev => prev.filter(item => item.id !== id));
    const cartTotal = useMemo(() => cart.reduce((acc, item) => acc + (item.price * item.qty), 0), [cart]);

    const handleCheckout = async () => {
        if (!user || cart.length === 0) return;
        let finalClient = { id: 'anonimo', name: 'Anónimo', role: 'guest' };
        if (userData.role === 'admin' && selectedCustomer) finalClient = { id: selectedCustomer.id, name: selectedCustomer.name, role: 'customer' }; else if (userData.role === 'client') finalClient = { id: user.uid, name: userData.name, role: 'client' };
        const itemsWithCost = cart.map(i => { const originalProduct = products.find(p => p.id === i.id); return { ...i, cost: originalProduct ? (originalProduct.cost || 0) : 0 }; });
        const saleData = { type: 'sale', total: cartTotal, items: itemsWithCost, date: serverTimestamp(), clientId: finalClient.id, clientName: finalClient.name, clientRole: finalClient.role, sellerId: user.uid, paymentStatus: 'pending', paymentNote: '', paymentMethod: paymentMethod };
        try {
            const docRef = await addDoc(collection(db, 'stores', appId, 'transactions'), saleData);
            for (const item of cart) { const p = products.find(prod => prod.id === item.id); if (p) await updateDoc(doc(db, 'stores', appId, 'products', item.id), { stock: p.stock - item.qty }); }
            setCart([]); setSelectedCustomer(null); setCustomerSearch(''); setShowMobileCart(false); setPaymentMethod('cash');
            setLastTransactionId({ ...saleData, id: docRef.id, date: { seconds: Date.now() / 1000 } }); setShowCheckoutSuccess(true); setTimeout(() => setShowCheckoutSuccess(false), 4000);
        } catch (error) { alert("Error venta."); }
    };

    const handleUpdateTransaction = async (e) => { e.preventDefault(); if (!editingTransaction) return; const f = e.target; const updatedItems = editingTransaction.items.map((item, index) => ({ ...item, name: f[`item_name_${index}`].value, qty: parseInt(f[`item_qty_${index}`].value), price: parseFloat(f[`item_price_${index}`].value), cost: item.cost || 0 })); const newTotal = updatedItems.reduce((acc, item) => acc + (item.price * item.qty), 0); try { await updateDoc(doc(db, 'stores', appId, 'transactions', editingTransaction.id), { paymentStatus: f.paymentStatus.value, paymentNote: f.paymentNote.value, items: updatedItems, total: newTotal }); setIsTransactionModalOpen(false); setEditingTransaction(null); } catch (error) { alert("Error"); } };
    const handleSaveExpense = async (e) => { e.preventDefault(); const f = e.target; try { await addDoc(collection(db, 'stores', appId, 'expenses'), { description: f.description.value, amount: parseFloat(f.amount.value), date: serverTimestamp() }); setIsExpenseModalOpen(false); } catch (error) { alert("Error"); } };
    const handleDeleteExpense = async (id) => { if (confirm("¿Eliminar?")) await deleteDoc(doc(db, 'stores', appId, 'expenses', id)); };
    const handleSaveProduct = async (e) => { e.preventDefault(); const f = e.target; const img = imageMode === 'file' ? previewImage : (f.imageUrlLink?.value || ''); const d = { name: f.name.value, barcode: f.barcode.value, price: parseFloat(f.price.value), cost: parseFloat(f.cost.value || 0), stock: parseInt(f.stock.value), categoryId: f.category.value, imageUrl: img }; if (editingProduct) await updateDoc(doc(db, 'stores', appId, 'products', editingProduct.id), d); else await addDoc(collection(db, 'stores', appId, 'products'), { ...d, createdAt: serverTimestamp() }); setIsProductModalOpen(false); };
    const handleSaveCustomer = async (e) => { e.preventDefault(); const f = e.target; const d = { name: f.name.value, phone: f.phone.value, address: f.address.value, email: f.email.value }; try { if (editingCustomer) await updateDoc(doc(db, 'stores', appId, 'customers', editingCustomer.id), d); else await addDoc(collection(db, 'stores', appId, 'customers'), { ...d, createdAt: serverTimestamp() }); setIsCustomerModalOpen(false); } catch (e) { alert("Error"); } };
    const handleSaveCategory = async (e) => { e.preventDefault(); if (e.target.catName.value) { await addDoc(collection(db, 'stores', appId, 'categories'), { name: e.target.catName.value, createdAt: serverTimestamp() }); setIsCategoryModalOpen(false); } };
    const handleDeleteProduct = async (id) => { if (confirm('¿Borrar?')) await deleteDoc(doc(db, 'stores', appId, 'products', id)); };
    const handleDeleteCategory = async (id) => { if (confirm('¿Borrar?')) await deleteDoc(doc(db, 'stores', appId, 'categories', id)); };
    const handleDeleteCustomer = async (id) => { if (confirm('¿Borrar?')) await deleteDoc(doc(db, 'stores', appId, 'customers', id)); };
    const handleFileChange = (e) => { const f = e.target.files[0]; if (f && f.size <= 800000) { const r = new FileReader(); r.onloadend = () => setPreviewImage(r.result); r.readAsDataURL(f); } };
    const handleOpenModal = (p = null) => { setEditingProduct(p); setPreviewImage(p?.imageUrl || ''); setImageMode(p?.imageUrl?.startsWith('data:') ? 'file' : 'link'); setIsProductModalOpen(true); };
    const handleBarcodeSubmit = (e) => { e.preventDefault(); if (!barcodeInput) return; const product = products.find(p => p.barcode === barcodeInput); if (product) { addToCart(product); setBarcodeInput(''); } else { alert("Producto no encontrado."); setBarcodeInput(''); } };
    const handleInventoryBarcodeSubmit = (e) => { e.preventDefault(); if (!inventoryBarcodeInput) return; const product = products.find(p => p.barcode === inventoryBarcodeInput); if (product) { setScannedProduct(product); setIsAddStockModalOpen(true); setTimeout(() => quantityInputRef.current?.focus(), 100); setInventoryBarcodeInput(''); } else { if (confirm("Producto no existe. ¿Crear nuevo?")) { setEditingProduct({ barcode: inventoryBarcodeInput }); setIsProductModalOpen(true); } setInventoryBarcodeInput(''); } };
    const handleAddStock = async (e) => { e.preventDefault(); const qty = parseInt(e.target.qty.value) || 0; if (scannedProduct && qty !== 0) { const newStock = scannedProduct.stock + qty; try { await updateDoc(doc(db, 'stores', appId, 'products', scannedProduct.id), { stock: newStock }); } catch (e) { alert("Error al actualizar stock"); } } setIsAddStockModalOpen(false); setScannedProduct(null); };

    const handleExportCSV = async () => {
        if (transactions.length === 0) return alert("No hay datos.");
        const csv = ["Fecha,Cliente,Estado,Total,Productos"].concat(transactions.map(t => `${new Date(t.date?.seconds * 1000).toLocaleDateString()},${t.clientName},${t.paymentStatus || 'pending'},${t.total},"${t.items?.map(i => `${i.qty} ${i.name}`).join('|')}"`)).join('\n');
        const l = document.createElement('a'); l.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); l.download = `ventas.csv`; document.body.appendChild(l); l.click(); document.body.removeChild(l);
    };

    if (authLoading) return <div className="h-screen flex items-center justify-center bg-slate-50 text-blue-600 font-bold">Cargando...</div>;

    if (!user || !userData) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
                    <div className="text-center mb-6">
                        {storeProfile.logoUrl ? <img src={storeProfile.logoUrl} className="w-16 h-16 mx-auto mb-2 rounded-xl object-cover shadow-sm" /> : <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-2"><Store size={24} /></div>}
                        <h1 className="text-2xl font-bold text-slate-800">{storeProfile.name}</h1> <p className="text-slate-500 text-sm">Acceso al Sistema</p>
                    </div>
                    <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
                        {isRegistering && (<><input name="name" required className="w-full p-3 border rounded-lg" placeholder="Nombre Completo" /><div className="grid grid-cols-2 gap-2"><input name="phone" required className="w-full p-3 border rounded-lg" placeholder="Teléfono" /><input name="address" required className="w-full p-3 border rounded-lg" placeholder="Dirección" /></div><div className="pt-2 border-t mt-2"><p className="text-xs text-slate-400 mb-1">Código Admin (Solo Personal):</p><input name="secretCode" className="w-full p-2 border rounded-lg text-sm" placeholder="Dejar vacío si eres cliente" /></div></>)}
                        <input name="email" type="email" required className="w-full p-3 border rounded-lg" placeholder="Correo" /><input name="password" type="password" required className="w-full p-3 border rounded-lg" placeholder="Contraseña" />
                        {loginError && <div className="text-red-500 text-sm text-center">{loginError}</div>}
                        <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg">{isRegistering ? 'Registrarse' : 'Entrar'}</button>
                    </form>
                    {!isRegistering && (<button type="button" onClick={handleResetPassword} className="w-full text-slate-400 text-xs hover:text-slate-600 mt-2 flex items-center justify-center gap-1"> <KeyRound size={12} /> ¿Olvidaste tu contraseña? </button>)}
                    <button onClick={() => setIsRegistering(!isRegistering)} className="w-full mt-4 text-blue-600 text-sm font-medium hover:underline">{isRegistering ? 'Volver al Login' : 'Crear Cuenta'}</button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-slate-100 font-sans text-slate-900 overflow-hidden">
            <Sidebar user={user} userData={userData} storeProfile={storeProfile} activeTab={activeTab} setActiveTab={setActiveTab} onLogout={() => setIsLogoutConfirmOpen(true)} />

            <div className="flex flex-col flex-1 min-w-0 h-full">
                <header className="lg:hidden bg-white shadow-sm border-b px-4 py-3 flex justify-between items-center z-[50] shrink-0 h-16">
                    <button onClick={() => userData.role === 'admin' && setIsStoreModalOpen(true)} className="flex items-center gap-2 font-bold text-lg text-slate-800 truncate">
                        {storeProfile.logoUrl ? <img src={storeProfile.logoUrl} className="w-8 h-8 object-cover rounded" /> : <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white"><Store size={16} /></div>}
                        <span className="truncate max-w-[150px]">{storeProfile.name}</span>
                    </button>
                    <div className="flex gap-3"><button onClick={() => setIsLogoutConfirmOpen(true)} className="bg-slate-100 p-2 rounded-full text-slate-600"><LogOut size={18} /></button></div>
                </header>

                <main className="flex-1 overflow-hidden p-4 relative z-0 flex flex-col">
                    {activeTab === 'pos' && (
                        <div className="flex flex-col h-full lg:flex-row gap-4 overflow-hidden relative">
                            <ProductGrid
                                products={products} addToCart={addToCart} searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                                selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} categories={categories}
                                userData={userData} barcodeInput={barcodeInput} setBarcodeInput={setBarcodeInput} handleBarcodeSubmit={handleBarcodeSubmit}
                            />
                            <div className="hidden lg:block w-80 rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                                <Cart cart={cart} updateCartQty={updateCartQty} removeFromCart={removeFromCart} setCartItemQty={setCartItemQty} userData={userData} selectedCustomer={selectedCustomer} setSelectedCustomer={setSelectedCustomer} customerSearch={customerSearch} setCustomerSearch={setCustomerSearch} customers={customers} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} cartTotal={cartTotal} handleCheckout={handleCheckout} setShowMobileCart={setShowMobileCart} />
                            </div>
                            {showMobileCart && <div className="lg:hidden absolute inset-0 z-[60] bg-white flex flex-col animate-in slide-in-from-bottom duration-200"><Cart cart={cart} updateCartQty={updateCartQty} removeFromCart={removeFromCart} setCartItemQty={setCartItemQty} userData={userData} selectedCustomer={selectedCustomer} setSelectedCustomer={setSelectedCustomer} customerSearch={customerSearch} setCustomerSearch={setCustomerSearch} customers={customers} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} cartTotal={cartTotal} handleCheckout={handleCheckout} setShowMobileCart={setShowMobileCart} /></div>}
                            {cart.length > 0 && !showMobileCart && (<button onClick={() => setShowMobileCart(true)} className="lg:hidden absolute bottom-20 left-4 right-4 bg-blue-600 text-white p-4 rounded-xl shadow-2xl flex justify-between items-center z-[55] animate-in fade-in zoom-in"><div className="flex items-center gap-2 font-bold"><ShoppingCart size={20} /> Ver Pedido ({cart.reduce((a, b) => a + b.qty, 0)})</div><div className="font-bold text-lg">${cartTotal} <ChevronRight size={18} className="inline" /></div></button>)}
                        </div>
                    )}

                    {activeTab === 'dashboard' && userData.role === 'admin' && (
                        <Dashboard balance={balance} expenses={expenses} setIsExpenseModalOpen={setIsExpenseModalOpen} handleDeleteExpense={handleDeleteExpense} />
                    )}

                    {activeTab === 'inventory' && userData.role === 'admin' && (
                        <div className="flex flex-col h-full overflow-hidden pb-20 lg:pb-0">
                            <div className="flex justify-between items-center mb-4 flex-shrink-0">
                                <h2 className="text-xl font-bold text-slate-800">Inventario</h2>
                                <div className="flex gap-2">
                                    <button onClick={() => setIsCategoryModalOpen(true)} className="bg-slate-100 text-slate-600 px-3 py-2 rounded-lg flex items-center gap-1 text-sm font-medium"><Tags className="w-4 h-4" /> Cats</button>
                                    <button onClick={() => handleOpenModal()} className="bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center gap-1 text-sm font-medium"><Plus className="w-4 h-4" /> Prod</button>
                                </div>
                            </div>
                            <ProductGrid products={products} addToCart={handleOpenModal} searchTerm={searchTerm} setSearchTerm={setSearchTerm} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} categories={categories} userData={userData} barcodeInput={inventoryBarcodeInput} setBarcodeInput={setInventoryBarcodeInput} handleBarcodeSubmit={handleInventoryBarcodeSubmit} />
                        </div>
                    )}

                    {activeTab === 'customers' && userData.role === 'admin' && (
                        <div className="flex flex-col h-full overflow-hidden pb-20 lg:pb-0">
                            <div className="flex justify-between items-center mb-4 flex-shrink-0">
                                <h2 className="text-xl font-bold">Clientes</h2>
                                <button onClick={() => { setEditingCustomer(null); setIsCustomerModalOpen(true); }} className="bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center gap-1 text-sm font-medium"><Plus className="w-4 h-4" /> Cliente</button>
                            </div>
                            <div className="flex-1 overflow-y-auto bg-white rounded-xl shadow-sm border">{customers.map(c => { const debt = getCustomerDebt(c.id); return (<div key={c.id} className="p-4 border-b flex justify-between items-center hover:bg-slate-50"><div><div className="font-bold text-slate-800">{c.name}</div><div className="flex gap-3 text-xs text-slate-500 mt-1"><span className="flex items-center gap-1"><Phone size={12} /> {c.phone}</span><span className="flex items-center gap-1"><MapPin size={12} /> {c.address}</span></div>{debt > 0 && <div className="mt-1 text-xs font-bold text-red-600 bg-red-50 inline-block px-2 py-0.5 rounded">Debe: ${debt}</div>}</div><div className="flex gap-2"><button onClick={() => { setEditingCustomer(c); setIsCustomerModalOpen(true); }} className="text-blue-600 text-xs font-bold border px-2 py-1 rounded">Edit</button><button onClick={() => handleDeleteCustomer(c.id)} className="text-red-600 text-xs font-bold border px-2 py-1 rounded">Del</button></div></div>); })}</div>
                        </div>
                    )}

                    {activeTab === 'transactions' && (
                        <History transactions={transactions} userData={userData} handleExportCSV={handleExportCSV} historySection={historySection} setHistorySection={setHistorySection} onEditTransaction={(t) => { setEditingTransaction(t); setIsTransactionModalOpen(true); }} onPrintTicket={handlePrintTicket} onShareWhatsApp={handleShareWhatsApp} />
                    )}
                </main>

                {!showMobileCart && <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} userData={userData} onLogout={() => setIsLogoutConfirmOpen(true)} />}

                {/* MODALES */}
                {isExpenseModalOpen && userData.role === 'admin' && <ExpenseModal onClose={() => setIsExpenseModalOpen(false)} onSave={handleSaveExpense} />}
                {isProductModalOpen && userData.role === 'admin' && <ProductModal onClose={() => setIsProductModalOpen(false)} onSave={handleSaveProduct} onDelete={handleDeleteProduct} editingProduct={editingProduct} imageMode={imageMode} setImageMode={setImageMode} previewImage={previewImage} setPreviewImage={setPreviewImage} handleFileChange={handleFileChange} categories={categories} />}
                {isCategoryModalOpen && userData.role === 'admin' && <CategoryModal onClose={() => setIsCategoryModalOpen(false)} onSave={handleSaveCategory} onDelete={handleDeleteCategory} categories={categories} />}
                {isCustomerModalOpen && userData.role === 'admin' && <CustomerModal onClose={() => setIsCustomerModalOpen(false)} onSave={handleSaveCustomer} editingCustomer={editingCustomer} />}
                {isStoreModalOpen && userData.role === 'admin' && <StoreModal onClose={() => setIsStoreModalOpen(false)} onSave={handleUpdateStore} storeProfile={storeProfile} imageMode={imageMode} setImageMode={setImageMode} previewImage={previewImage} setPreviewImage={setPreviewImage} handleFileChange={handleFileChange} />}
                {isAddStockModalOpen && scannedProduct && <AddStockModal onClose={() => { setIsAddStockModalOpen(false); setScannedProduct(null); }} onConfirm={handleAddStock} scannedProduct={scannedProduct} quantityInputRef={quantityInputRef} />}
                {isTransactionModalOpen && userData.role === 'admin' && editingTransaction && <TransactionModal onClose={() => setIsTransactionModalOpen(false)} onSave={handleUpdateTransaction} editingTransaction={editingTransaction} />}
                {isLogoutConfirmOpen && <LogoutConfirmModal onClose={() => setIsLogoutConfirmOpen(false)} onConfirm={handleFinalLogout} />}

                {showCheckoutSuccess && <div className="fixed top-20 right-4 bg-green-600 text-white px-6 py-4 rounded-lg shadow-xl animate-bounce z-[105] flex items-center gap-4"><div><p className="font-bold text-sm">¡Venta Exitosa!</p></div><div className="flex gap-2"><button onClick={() => { handlePrintTicket(lastTransactionId); setShowCheckoutSuccess(false); }} className="bg-white text-green-600 px-3 py-1 rounded text-xs font-bold hover:bg-green-50">Ticket</button></div></div>}
            </div>
        </div>
    );
}