import React, { useState, useEffect, lazy, Suspense, useRef } from 'react';
import { Store, KeyRound, Plus, LogOut, ShoppingCart, Bell, WifiOff, Tags, ClipboardList } from 'lucide-react';
import { serverTimestamp } from 'firebase/firestore';

// Contextos
import { useAuthContext }         from './context/AuthContext';
import { useInventoryContext }    from './context/InventoryContext';
import { useTransactionsContext } from './context/TransactionsContext';
import { useCartContext }         from './context/CartContext';

// Hooks
import { usePrinter }       from './hooks/usePrinter';
import { usePWA }           from './hooks/usePWA';
import { useCheckout }      from './hooks/useCheckout';
import { useExports }       from './hooks/useExports';
import { useNotifications } from './hooks/useNotifications';
import { uploadImage }      from './config/uploadImage';
import { compressImage }    from './utils/imageHelpers';

// Componentes
import Sidebar, { MobileNav } from './components/Sidebar';
import Cart           from './components/Cart';
import ProductGrid    from './components/ProductGrid';
import {
    ExpenseModal, ProductModal, CategoryModal, CustomerModal,
    StoreModal, AddStockModal, TransactionModal, LogoutConfirmModal,
    InvitationModal, ProcessingModal, ConfirmModal, FaultyProductModal
} from './components/Modals';

// Lazy Loading
const Dashboard         = lazy(() => import('./components/Dashboard'));
const History           = lazy(() => import('./components/History'));
const TransactionDetail = lazy(() => import('./components/TransactionDetail'));
const Orders            = lazy(() => import('./components/Orders'));
const Delivery          = lazy(() => import('./components/Delivery'));

const TabLoader = () => (
    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 animate-in fade-in zoom-in">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        <span className="text-xs font-bold">Cargando...</span>
    </div>
);

export default function App() {
    const [activeTab, setActiveTab]           = useState('pos');
    const [isOnline, setIsOnline]             = useState(navigator.onLine);
    const [showMobileCart, setShowMobileCart] = useState(false);
    const [notification, setNotification]     = useState(null);
    const [confirmConfig, setConfirmConfig]   = useState(null);
    // ✅ dashboardDateRange eliminado — se usa dateRange/setDateRange del TransactionsContext

    const { supportsPWA, installApp } = usePWA();

    const [modals, setModals] = useState({
        product: false, category: false, customer: false, transaction: false,
        store: false, stock: false, expense: false, logout: false,
        invitation: false, faulty: false
    });
    const toggleModal = (name, value) => setModals(prev => ({ ...prev, [name]: value }));

    // Contextos
    const { user, userData, authLoading, loginError, setLoginError, login, register, logout, resetPassword } = useAuthContext();
    const {
        products, categories, subcategories, customers, expenses, storeProfile,
        addProduct, updateProduct, deleteProduct, addStock,
        addCategory, deleteCategory, updateCategory,
        addSubCategory, deleteSubCategory,
        addCustomer, updateCustomer, deleteCustomer,
        addExpense, deleteExpense,
        updateStoreProfile, generateInvitationCode, registerFaultyProduct
    } = useInventoryContext();
    const { transactions, lastTransactionId, createTransaction, updateTransaction, deleteTransaction, purgeTransactions, balance, dateRange, setDateRange } = useTransactionsContext();
    const { cart, addToCart, updateCartQty, setCartItemQty, removeFromCart, clearCart, cartTotal, paymentMethod, setPaymentMethod } = useCartContext();
    const printer = usePrinter();

    // Estados UI locales
    const [selectedTransaction, setSelectedTransaction]   = useState(null);
    const [editingTransaction, setEditingTransaction]     = useState(null);
    const [faultyProduct, setFaultyProduct]               = useState(null);
    const [editingProduct, setEditingProduct]             = useState(null);
    const [editingCustomer, setEditingCustomer]           = useState(null);
    const [selectedCustomer, setSelectedCustomer]         = useState(null);
    const [scannedProduct, setScannedProduct]             = useState(null);
    const [searchTerm, setSearchTerm]                     = useState('');
    const [selectedCategory, setSelectedCategory]         = useState('all');
    const [customerSearch, setCustomerSearch]             = useState('');
    const [barcodeInput, setBarcodeInput]                 = useState('');
    const [inventoryBarcodeInput, setInventoryBarcodeInput] = useState('');
    const [imageMode, setImageMode]                       = useState('link');
    const [previewImage, setPreviewImage]                 = useState('');
    const [isRegistering, setIsRegistering]               = useState(false);
    const [historySection, setHistorySection]             = useState('menu');

    const quantityInputRef = useRef(null);

    // ── Notificación visual interna ────────────────────────────────────────────
    const showNotification = (msg) => {
        setNotification(msg);
        setTimeout(() => setNotification(null), 3000);
    };

    // ── Confirmación reutilizable ──────────────────────────────────────────────
    const requestConfirm = (title, message, action, isDanger = false) => {
        setConfirmConfig({
            title, message, isDanger,
            onConfirm: async () => { setConfirmConfig(null); await action(); },
            onCancel:  () => setConfirmConfig(null)
        });
    };

    // ── Hooks extraídos ────────────────────────────────────────────────────────
    const { isProcessing, setIsProcessing, lastSale, showCheckoutSuccess, setShowCheckoutSuccess, checkoutError, setCheckoutError, pendingSync, handleCheckout } = useCheckout({
        user, userData, cart, products, cartTotal, paymentMethod,
        selectedCustomer, createTransaction, clearCart, showNotification
    });

    const { handlePrintShoppingList, handleExportData } = useExports({
        products, transactions, expenses, balance, storeProfile,
        dashboardDateRange: dateRange, purgeTransactions, showNotification,
        requestConfirm, setIsProcessing
    });

    // ── Notificaciones push (FCM, funciona con app cerrada) ───────────────────
    useNotifications(user, userData);

    // ── Pedidos pendientes para badge ──────────────────────────────────────────
    const pendingOrders = transactions.filter(t =>
        t.clientRole === 'client' && t.fulfillmentStatus === 'pending'
    );
    const prevOrdersCount = useRef(pendingOrders.length);

    useEffect(() => {
        if (userData?.role === 'admin' && pendingOrders.length > prevOrdersCount.current) {
            showNotification("🔔 ¡Nuevo pedido de cliente!");
            // El push a dispositivo lo maneja la Cloud Function via FCM
        }
        prevOrdersCount.current = pendingOrders.length;
    }, [pendingOrders.length, userData?.role]);

    // ── Botón "Atrás" del celular ──────────────────────────────────────────────
    useEffect(() => {
        const handler = () => { if (selectedTransaction) setSelectedTransaction(null); };
        window.addEventListener('popstate', handler);
        return () => window.removeEventListener('popstate', handler);
    }, [selectedTransaction]);

    // ── Estado de conexión ─────────────────────────────────────────────────────
    useEffect(() => {
        const handler = () => {
            setIsOnline(navigator.onLine);
            showNotification(navigator.onLine ? "🟢 Conexión restaurada" : "🔴 Sin conexión (Modo Offline)");
        };
        window.addEventListener('online',  handler);
        window.addEventListener('offline', handler);
        return () => { window.removeEventListener('online', handler); window.removeEventListener('offline', handler); };
    }, []);

    // ── Handlers de formularios ────────────────────────────────────────────────
    const handleAuthSubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        try {
            if (isRegistering) {
                await register({
                    name: form.name.value, phone: form.phone.value,
                    address: form.address.value, email: form.email.value,
                    password: form.password.value,
                    inviteCode: form.inviteCode?.value || ''
                });
            } else {
                await login(form.email.value, form.password.value);
            }
        } catch (e) { /* el error ya se setea en loginError */ }
    };

    const handleSaveProductWrapper = async (e) => {
        e.preventDefault();
        const f = e.target;
        const rawImage = imageMode === 'file' ? previewImage : (f.imageUrlLink?.value || '');
        setIsProcessing(true);
        try {
            const finalImageUrl = await uploadImage(rawImage, f.name.value);
            const data = {
                name: f.name.value, barcode: f.barcode.value,
                price: parseFloat(f.price.value),
                cost: parseFloat(f.cost.value || 0),
                stock: parseInt(f.stock.value),
                categoryId: f.category.value,
                subCategoryId: f.subcategory.value,
                imageUrl: finalImageUrl || ''
            };
            if (editingProduct) await updateProduct(editingProduct.id, data);
            else                await addProduct(data);
            toggleModal('product', false);
            showNotification("✅ Producto guardado");
        } catch (e) {
            showNotification("❌ Error: " + e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleInventoryBarcodeSubmit = (e) => {
        e.preventDefault();
        if (!inventoryBarcodeInput) return;
        const p = products.find(p => p.barcode === inventoryBarcodeInput);
        if (p) {
            setScannedProduct(p);
            toggleModal('stock', true);
            setTimeout(() => quantityInputRef.current?.focus(), 100);
        } else {
            requestConfirm("Producto no existe", "¿Crear nuevo?", () => {
                setEditingProduct({ barcode: inventoryBarcodeInput });
                toggleModal('product', true);
            });
        }
        setInventoryBarcodeInput('');
    };

    const handleFileChange = async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        if (f.size > 5 * 1024 * 1024) { showNotification("⚠️ Imagen muy pesada (Máx 5MB)"); return; }
        setIsProcessing(true);
        const base64 = await compressImage(f);
        setPreviewImage(base64);
        setIsProcessing(false);
    };

    // ── Handlers de modales (extraídos para legibilidad y debugging) ────────────

    const handleSaveExpense = async (e) => {
        e.preventDefault();
        try {
            await addExpense({
                description: e.target.description.value,
                amount: parseFloat(e.target.amount.value)
            });
            toggleModal('expense', false);
        } catch { showNotification("❌ Error al guardar gasto"); }
    };

    const handleSaveCategory = async (e) => {
        e.preventDefault();
        if (e.target.catName.value) {
            await addCategory(e.target.catName.value);
            toggleModal('category', false);
        }
    };

    const handleSaveCustomer = async (e) => {
        e.preventDefault();
        const d = {
            name: e.target.name.value,
            phone: e.target.phone.value,
            address: e.target.address.value,
            email: e.target.email.value
        };
        try {
            if (editingCustomer) await updateCustomer(editingCustomer.id, d);
            else await addCustomer(d);
            toggleModal('customer', false);
        } catch { showNotification("❌ Error al guardar cliente"); }
    };

    const handleSaveStore = async (e) => {
        e.preventDefault();
        const form = e.target;
        const newName = form.storeName.value;
        let newLogo = storeProfile.logoUrl;
        if (imageMode === 'file') {
            if (previewImage) newLogo = previewImage;
        } else {
            if (form.logoUrlLink) newLogo = form.logoUrlLink.value;
        }
        try {
            await updateStoreProfile({ name: newName, logoUrl: newLogo });
            toggleModal('store', false);
            showNotification("✅ Perfil actualizado");
        } catch (error) {
            showNotification("❌ Error al guardar: " + error.message);
        }
    };

    const handleAddStock = async (e) => {
        e.preventDefault();
        await addStock(scannedProduct, parseInt(e.target.qty.value));
        toggleModal('stock', false);
        setScannedProduct(null);
    };

    const handleSaveTransaction = async (d) => {
        if (!d.items || d.items.length === 0 || d.total === 0) {
            showNotification("⚠️ Los datos de la boleta aún no han cargado.");
            return;
        }
        setIsProcessing(true);
        try {
            await updateTransaction(editingTransaction.id, d);
            toggleModal('transaction', false);
            showNotification("✅ Boleta actualizada");
            if (selectedTransaction?.id === editingTransaction.id) {
                setSelectedTransaction(prev => ({ ...prev, ...d }));
            }
        } catch { showNotification("❌ No se pudieron guardar los cambios."); }
        finally { setIsProcessing(false); }
    };

    const handleConfirmLogout = async () => {
        await logout();
        toggleModal('logout', false);
    };

    const handleConfirmFaulty = async (p, q, r) => {
        setIsProcessing(true);
        await registerFaultyProduct(p, q, r);
        toggleModal('faulty', false);
        setIsProcessing(false);
        showNotification("✅ Falla registrada como gasto");
    };

        // ── Pantallas de carga y login ─────────────────────────────────────────────
    if (authLoading) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-slate-50 text-blue-600 font-bold">
                <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                Cargando Sistema...
                {!isOnline && <span className="text-xs text-slate-400 mt-2">Iniciando en modo offline</span>}
            </div>
        );
    }

    if (!user || !userData) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
                <div className="bg-white p-2 md:p-8 rounded-2xl shadow-xl w-full max-w-md">
                    <div className="text-center mb-6">
                        {storeProfile.logoUrl
                            ? <img src={storeProfile.logoUrl} className="w-16 h-16 mx-auto mb-2 rounded-xl object-cover" />
                            : <Store className="mx-auto text-blue-600 mb-2" size={48} />}
                        <h1 className="text-2xl font-bold text-slate-800">{storeProfile.name}</h1>
                    </div>
                    <form onSubmit={handleAuthSubmit} className="space-y-4">
                        {isRegistering && (
                            <>
                                <input name="name" required className="w-full p-3 border rounded-lg" placeholder="Nombre" />
                                <div className="grid grid-cols-2 gap-2">
                                    <input name="phone" required className="w-full p-3 border rounded-lg" placeholder="Teléfono" />
                                    <input name="address" required className="w-full p-3 border rounded-lg" placeholder="Dirección" />
                                </div>
                                <input name="inviteCode" required className="w-full p-2 border rounded-lg text-center font-bold uppercase" placeholder="CÓDIGO INVITACIÓN" />
                            </>
                        )}
                        <input name="email" type="email" required className="w-full p-3 border rounded-lg" placeholder="Correo" />
                        <input name="password" type="password" required className="w-full p-3 border rounded-lg" placeholder="Contraseña" />
                        {loginError && <div className="text-red-500 text-sm text-center">{loginError}</div>}
                        <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg">
                            {isRegistering ? 'Registrarse' : 'Entrar'}
                        </button>
                    </form>
                    <button onClick={() => { setIsRegistering(!isRegistering); setLoginError(''); }} className="w-full mt-4 text-blue-600 text-sm font-medium hover:underline">
                        {isRegistering ? 'Volver al Login' : 'Crear Cuenta'}
                    </button>
                    {!isRegistering && (
                        <button
                            onClick={() => {
                                const emailInput = document.querySelector('input[name="email"]');
                                if (!emailInput?.value) { setLoginError("Escribe tu correo primero."); return; }
                                resetPassword(emailInput.value)
                                    .then(() => showNotification("📧 Correo de recuperación enviado"))
                                    .catch(e => setLoginError(e.message));
                            }}
                            className="w-full mt-2 text-slate-400 text-xs hover:text-slate-600"
                        >
                            Olvidé contraseña
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // ── UI Principal ───────────────────────────────────────────────────────────
    return (
        <div className="flex h-screen bg-slate-100 font-sans text-slate-900 overflow-hidden relative">
            <Sidebar
                user={user} userData={userData} storeProfile={storeProfile}
                activeTab={activeTab} setActiveTab={setActiveTab}
                onLogout={() => toggleModal('logout', true)}
                onEditStore={() => toggleModal('store', true)}
                supportsPWA={supportsPWA} installApp={installApp}
                pendingCount={pendingOrders.length}
            />

            {!isOnline && (
                <div className="fixed bottom-24 left-0 right-0 bg-slate-800 text-white text-xs font-bold py-1 text-center z-[2000] animate-pulse opacity-90">
                    <WifiOff size={12} className="inline mr-1" /> OFFLINE
                </div>
            )}

            {confirmConfig && <ConfirmModal {...confirmConfig} />}
            {notification && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl z-[1000] animate-in slide-in-from-top-10 fade-in flex items-center gap-3">
                    <Bell size={18} className="text-yellow-400" />
                    <span className="font-bold text-sm">{notification}</span>
                </div>
            )}
            {isProcessing && <ProcessingModal />}

            <div className="flex flex-col flex-1 min-w-0 h-full">
                {/* Header móvil */}
                <header className="lg:hidden bg-white shadow-sm border-b px-4 py-3 flex justify-between items-center z-[50] shrink-0 h-16">
                    <button onClick={() => userData.role === 'admin' && toggleModal('store', true)} className="flex items-center gap-2 font-bold text-lg text-slate-800 truncate">
                        {storeProfile.logoUrl ? <img src={storeProfile.logoUrl} className="w-8 h-8 object-cover rounded" /> : <Store className="text-blue-600" />}
                        <span>{storeProfile.name}</span>
                    </button>
                    <button onClick={() => toggleModal('logout', true)} className="bg-slate-100 p-2 rounded-full"><LogOut size={18} /></button>
                </header>

                <main className="flex-1 overflow-hidden relative z-0 flex flex-col bg-slate-100">

                    {/* POS */}
                    {activeTab === 'pos' && (
                        <div className="flex flex-col h-full lg:flex-row gap-4 overflow-hidden relative p-4 pb-0 lg:pb-4">
                            <ProductGrid
                                products={products} addToCart={addToCart}
                                searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                                selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory}
                                categories={categories} subcategories={subcategories}
                                userData={userData} barcodeInput={barcodeInput} setBarcodeInput={setBarcodeInput}
                                cart={cart}
                                handleBarcodeSubmit={(e) => {
                                    e.preventDefault();
                                    if (!barcodeInput) return;
                                    const p = products.find(x => x.barcode === barcodeInput);
                                    if (p) { addToCart(p); setBarcodeInput(''); }
                                    else showNotification("⚠️ Producto no encontrado");
                                }}
                                onEditProduct={(p) => { setEditingProduct(p); toggleModal('product', true); }}
                                setFaultyProduct={setFaultyProduct}
                                toggleModal={toggleModal}
                            />
                            <div className="hidden lg:block w-80 rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                                <Cart
                                    cart={cart} updateCartQty={updateCartQty} removeFromCart={removeFromCart}
                                    setCartItemQty={setCartItemQty} userData={userData}
                                    selectedCustomer={selectedCustomer} setSelectedCustomer={setSelectedCustomer}
                                    customerSearch={customerSearch} setCustomerSearch={setCustomerSearch}
                                    customers={customers} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
                                    cartTotal={cartTotal}
                                    handleCheckout={() => handleCheckout({ setShowMobileCart, setSelectedCustomer })}
                                    setShowMobileCart={setShowMobileCart}
                                />
                            </div>
                            {showMobileCart && (
                                <div className="lg:hidden absolute inset-0 z-[60] bg-white flex flex-col animate-in slide-in-from-bottom">
                                    <Cart
                                        cart={cart} updateCartQty={updateCartQty} removeFromCart={removeFromCart}
                                        setCartItemQty={setCartItemQty} userData={userData}
                                        selectedCustomer={selectedCustomer} setSelectedCustomer={setSelectedCustomer}
                                        customerSearch={customerSearch} setCustomerSearch={setCustomerSearch}
                                        customers={customers} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
                                        cartTotal={cartTotal}
                                        handleCheckout={() => handleCheckout({ setShowMobileCart, setSelectedCustomer })}
                                        setShowMobileCart={setShowMobileCart}
                                    />
                                </div>
                            )}
                            {cart.length > 0 && !showMobileCart && (
                                <button onClick={() => setShowMobileCart(true)} className="lg:hidden absolute bottom-24 left-4 right-4 bg-blue-600 text-white p-4 rounded-xl shadow-2xl flex justify-between items-center z-[55] animate-in fade-in zoom-in">
                                    <div className="flex items-center gap-2 font-bold"><ShoppingCart size={20} /> Ver Pedido ({cart.reduce((a, b) => a + b.qty, 0)})</div>
                                    <div className="font-bold text-lg">${cartTotal.toLocaleString()}</div>
                                </button>
                            )}
                        </div>
                    )}

                    {/* Dashboard */}
                    {activeTab === 'dashboard' && userData.role === 'admin' && (
                        <Suspense fallback={<TabLoader />}>
                            <Dashboard
                                balance={balance} expenses={expenses}
                                setIsExpenseModalOpen={(v) => toggleModal('expense', v)}
                                handleDeleteExpense={(id) => requestConfirm("Borrar Gasto", "¿Seguro?", () => deleteExpense(id), true)}
                                dateRange={dateRange} setDateRange={setDateRange}
                            />
                        </Suspense>
                    )}

                    {/* Pedidos */}
                    {activeTab === 'orders' && userData.role === 'admin' && (
                        <Suspense fallback={<TabLoader />}>
                            <Orders
                                transactions={transactions} products={products} categories={categories}
                                onUpdateTransaction={(id, data) => updateTransaction(id, data)}
                                onSelectTransaction={(t) => setSelectedTransaction(t)}
                            />
                        </Suspense>
                    )}

                    {/* Reparto */}
                    {activeTab === 'delivery' && userData.role === 'admin' && (
                        <div className="flex-1 overflow-hidden p-4 pb-24 lg:pb-4">
                            <Suspense fallback={<TabLoader />}>
                                <Delivery
                                    transactions={transactions} customers={customers}
                                    onUpdateTransaction={updateTransaction}
                                    onSelectTransaction={(t) => setSelectedTransaction(t)}
                                    onRequestConfirm={requestConfirm}
                                />
                            </Suspense>
                        </div>
                    )}

                    {/* Inventario */}
                    {activeTab === 'inventory' && userData.role === 'admin' && (
                        <div className="flex flex-col h-full overflow-hidden p-4 pb-24 lg:pb-4">
                            <div className="flex justify-between items-center mb-4 flex-shrink-0">
                                <h2 className="text-xl font-bold text-slate-800">Inventario</h2>
                                <div className="flex gap-2">
                                    <button onClick={() => toggleModal('category', true)} className="bg-slate-100 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium flex gap-1"><Tags size={16} /> Cats</button>
                                    <button onClick={handlePrintShoppingList} className="bg-yellow-50 text-yellow-700 border border-yellow-200 px-3 py-2 rounded-lg text-sm font-bold flex gap-1 hover:bg-yellow-100 transition-colors"><ClipboardList size={16} /> Faltantes</button>
                                    <button onClick={() => { setEditingProduct(null); setPreviewImage(''); toggleModal('product', true); }} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium flex gap-1"><Plus size={16} /> Prod</button>
                                </div>
                            </div>
                            <ProductGrid
                                products={products}
                                addToCart={(p) => { setEditingProduct(p); setPreviewImage(p.imageUrl || ''); setImageMode(p.imageUrl?.startsWith('data:') ? 'file' : 'link'); toggleModal('product', true); }}
                                searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                                selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory}
                                categories={categories} subcategories={subcategories}
                                userData={userData}
                                barcodeInput={inventoryBarcodeInput} setBarcodeInput={setInventoryBarcodeInput}
                                handleBarcodeSubmit={handleInventoryBarcodeSubmit}
                            />
                        </div>
                    )}

                    {/* Clientes */}
                    {activeTab === 'customers' && userData.role === 'admin' && (
                        <div className="flex flex-col h-full overflow-hidden p-4 pb-24 lg:pb-4">
                            <div className="flex justify-between items-center mb-4 flex-shrink-0">
                                <h2 className="text-xl font-bold">Clientes</h2>
                                <div className="flex gap-2">
                                    <button onClick={() => toggleModal('invitation', true)} className="bg-slate-100 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium flex gap-1"><KeyRound size={16} /> Invitación</button>
                                    <button onClick={() => { setEditingCustomer(null); toggleModal('customer', true); }} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium flex gap-1"><Plus size={16} /> Cliente</button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto bg-white rounded-xl shadow-sm border divide-y divide-slate-100">
                                {customers.map(c => (
                                    <div key={c.id} className="p-4 flex justify-between items-center hover:bg-slate-50">
                                        <div>
                                            <div className="font-bold text-slate-800">{c.name}</div>
                                            <div className="text-xs text-slate-500">{c.phone}</div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => { setEditingCustomer(c); toggleModal('customer', true); }} className="text-blue-600 text-xs font-bold border border-blue-200 bg-blue-50 px-3 py-1 rounded">Editar</button>
                                            <button onClick={() => requestConfirm("Borrar Cliente", "¿Seguro?", () => deleteCustomer(c.id), true)} className="text-red-600 text-xs font-bold border border-red-200 bg-red-50 px-3 py-1 rounded">Borrar</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Historial */}
                    {activeTab === 'transactions' && (
                        <div className="flex-1 overflow-hidden p-4 pb-24 lg:pb-4">
                            <Suspense fallback={<TabLoader />}>
                                <History
                                    transactions={transactions} userData={userData}
                                    handleExportCSV={handleExportData}
                                    historySection={historySection} setHistorySection={setHistorySection}
                                    onSelectTransaction={(t) => { setSelectedTransaction(t); window.history.pushState({ view: 't' }, ''); }}
                                />
                            </Suspense>
                        </div>
                    )}
                </main>

                {!showMobileCart && !selectedTransaction && (
                    <MobileNav
                        activeTab={activeTab} setActiveTab={setActiveTab}
                        userData={userData} onLogout={() => toggleModal('logout', true)}
                        supportsPWA={supportsPWA} installApp={installApp}
                        pendingCount={pendingOrders.length}
                    />
                )}

                {/* Detalle de transacción */}
                {selectedTransaction && (
                    <Suspense fallback={<ProcessingModal />}>
                        <TransactionDetail
                            transaction={selectedTransaction}
                            onClose={() => { setSelectedTransaction(null); if (window.history.state) window.history.back(); }}
                            printer={printer} storeProfile={storeProfile} customers={customers}
                            onEditItems={(t) => { setEditingTransaction(t); toggleModal('transaction', true); }}
                            userData={userData}
                        />
                    </Suspense>
                )}

                {/* Checkout success banner */}
                {showCheckoutSuccess && (
                    <div className="fixed top-20 right-4 bg-green-600 text-white px-6 py-4 rounded-lg shadow-xl animate-bounce z-[105] flex items-center gap-4">
                        <div className="flex flex-col">
                            <p className="font-bold text-sm">¡Venta Guardada!</p>
                            <p className="text-[10px] opacity-80">Modo offline activo</p>
                        </div>
                        <button
                            onClick={() => {
                                if (lastSale) { setSelectedTransaction(lastSale); setActiveTab('transactions'); window.history.pushState({ view: 't' }, ''); }
                                setShowCheckoutSuccess(false);
                            }}
                            className="bg-white text-green-600 px-3 py-1 rounded text-xs font-bold hover:bg-green-50"
                        >
                            Ver Boleta
                        </button>
                    </div>
                )}

                {/* ✅ Banner persistente: error de checkout o pedido offline pendiente */}
                {checkoutError && (
                    <div className={`fixed inset-x-4 bottom-24 lg:inset-x-auto lg:right-4 lg:bottom-6 lg:w-96 text-white px-5 py-4 rounded-xl shadow-2xl z-[110] border-2 ${checkoutError.isPendingSync ? 'bg-amber-600 border-amber-400' : 'bg-red-600 border-red-400'}`}>
                        <div className="flex items-start justify-between gap-3 mb-3">
                            <div>
                                <p className="font-bold text-base">
                                    {checkoutError.isPendingSync
                                        ? '⏳ Pedido guardado — sin sincronizar'
                                        : checkoutError.isOffline ? '📶 Sin conexión' : '⚠️ Error al registrar pedido'}
                                </p>
                                <p className="text-xs opacity-80 mt-1">Ocurrió a las {checkoutError.time}</p>
                            </div>
                            {!checkoutError.isPendingSync && (
                                <button onClick={() => setCheckoutError(null)} className="text-white opacity-70 hover:opacity-100 text-xl font-bold leading-none">✕</button>
                            )}
                        </div>
                        <div className={`rounded-lg p-3 mb-3 text-xs ${checkoutError.isPendingSync ? 'bg-amber-700' : 'bg-red-700'}`}>
                            <p className="font-bold mb-1">Detalle del pedido:</p>
                            <p className="opacity-90">{checkoutError.items}</p>
                            <p className="font-bold mt-1">Total: ${Number(checkoutError.total).toLocaleString('es-AR')}</p>
                        </div>
                        <p className="text-xs opacity-90 text-center">
                            {checkoutError.isPendingSync
                                ? 'El pedido está guardado en este dispositivo. Se enviará automáticamente cuando haya conexión.'
                                : checkoutError.isOffline
                                    ? 'Necesitás internet para enviar pedidos. Conectate y repetí el pedido.'
                                    : 'Anotá el pedido manualmente y avisá al administrador.'}
                        </p>
                    </div>
                )}

                {/* Modales */}
                {modals.expense && (
                    <ExpenseModal
                        onClose={() => toggleModal('expense', false)}
                        onSave={handleSaveExpense}
                    />
                )}
                {modals.product && (
                    <ProductModal
                        onClose={() => toggleModal('product', false)}
                        onSave={handleSaveProductWrapper}
                        onDelete={(id) => requestConfirm("Borrar", "¿Seguro?", () => deleteProduct(id), true)}
                        editingProduct={editingProduct}
                        imageMode={imageMode} setImageMode={setImageMode}
                        previewImage={previewImage} setPreviewImage={setPreviewImage}
                        handleFileChange={handleFileChange}
                        categories={categories} subcategories={subcategories}
                        onRegisterFaulty={(p) => { setFaultyProduct(p); toggleModal('faulty', true); }}
                    />
                )}
                {modals.category && (
                    <CategoryModal
                        onClose={() => toggleModal('category', false)}
                        onSave={handleSaveCategory}
                        onDelete={(id) => requestConfirm("Borrar", "¿Seguro?", () => deleteCategory(id), true)}
                        categories={categories} subcategories={subcategories}
                        onSaveSub={addSubCategory} onDeleteSub={deleteSubCategory}
                        onUpdate={updateCategory}
                    />
                )}
                {modals.customer && (
                    <CustomerModal
                        onClose={() => toggleModal('customer', false)}
                        onSave={handleSaveCustomer}
                        editingCustomer={editingCustomer}
                    />
                )}
                {modals.store && (
                    <StoreModal
                        onClose={() => toggleModal('store', false)}
                        storeProfile={storeProfile}
                        imageMode={imageMode} setImageMode={setImageMode}
                        previewImage={previewImage} setPreviewImage={setPreviewImage}
                        handleFileChange={handleFileChange}
                        onSave={handleSaveStore}
                    />
                )}
                {modals.stock && scannedProduct && (
                    <AddStockModal
                        onClose={() => { toggleModal('stock', false); setScannedProduct(null); }}
                        onConfirm={handleAddStock}
                        scannedProduct={scannedProduct}
                        quantityInputRef={quantityInputRef}
                    />
                )}
                {modals.transaction && editingTransaction && (
                    <TransactionModal
                        onClose={() => toggleModal('transaction', false)}
                        onSave={handleSaveTransaction}
                        editingTransaction={editingTransaction}
                    />
                )}
                {modals.logout && (
                    <LogoutConfirmModal
                        onClose={() => toggleModal('logout', false)}
                        onConfirm={handleConfirmLogout}
                    />
                )}
                {modals.invitation && (
                    <InvitationModal
                        onClose={() => toggleModal('invitation', false)}
                        onGenerate={generateInvitationCode}
                    />
                )}
                {modals.faulty && faultyProduct && (
                    <FaultyProductModal
                        product={faultyProduct}
                        onClose={() => toggleModal('faulty', false)}
                        onConfirm={handleConfirmFaulty}
                    />
                )}
            </div>
        </div>
    );
}
