import React, { useState, useEffect, lazy, Suspense, useRef, useCallback, useMemo } from 'react';
import { Store, KeyRound, Plus, LogOut, ShoppingCart, Bell, WifiOff, Tags, ClipboardList, Search, TrendingUp } from 'lucide-react';

// Contextos
import { useAuthContext }         from './context/AuthContext';
import { useInventoryContext }    from './context/InventoryContext';
import { useTransactionsContext } from './context/TransactionsContext';
import { useCartContext }         from './context/CartContext';

// Hooks
import { usePrinter }       from './hooks/usePrinter';
import { usePWA }           from './hooks/usePWA';
import { useCheckout }      from './hooks/useCheckout';
import { useSyncManager }   from './hooks/useSyncManager';
import { useExports }       from './hooks/useExports';
import { useNotifications } from './hooks/useNotifications';
import { useModals }        from './hooks/useModals';
import { useOnlineStatus }  from './hooks/useOnlineStatus';
import { useProductForm }       from './hooks/useProductForm';
import { useInventoryScanner }  from './hooks/useInventoryScanner';

// Componentes
import Sidebar, { MobileNav } from './components/Sidebar';
import Cart                   from './components/Cart';
import ProductGrid            from './components/ProductGrid';
import LoadingScreen          from './components/LoadingScreen';
import LoginScreen            from './components/LoginScreen';
import AppModals              from './components/AppModals';
import { ProcessingModal }    from './components/Modals';

// Lazy Loading
const Dashboard         = lazy(() => import('./components/Dashboard'));
const History           = lazy(() => import('./components/History'));
const TransactionDetail = lazy(() => import('./components/TransactionDetail'));
const Orders            = lazy(() => import('./components/Orders'));
const Delivery          = lazy(() => import('./components/Delivery'));

const TabLoader = () => (
    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 animate-in fade-in zoom-in">
        <div className="w-8 h-8 border-4 border-orange-100 border-t-orange-500 rounded-full animate-spin" />
        <span className="text-xs font-bold">Cargando...</span>
    </div>
);

export default function App() {
    const [activeTab, setActiveTab]           = useState('pos');
    const [notification, setNotification]     = useState(null);
    const [confirmConfig, setConfirmConfig]   = useState(null);
    const [showMobileCart, setShowMobileCart] = useState(false);

    // ── Notificación visual interna ────────────────────────────────────────────
    // useCallback con [] → referencia estable entre renders.
    // Sin esto, cualquier re-render de App creaba una nueva función,
    // lo que forzaba a useInventoryScanner a re-registrar el listener de keydown.
    const _notifTimer = useRef(null);
    const showNotification = useCallback((msg) => {
        if (_notifTimer.current) clearTimeout(_notifTimer.current);
        setNotification(msg);
        _notifTimer.current = setTimeout(() => setNotification(null), 5000);
    }, []);

    // ── Confirmación reutilizable ──────────────────────────────────────────────
    // Ídem: referencia estable para que processBarcode no se recree en cada render.
    const requestConfirm = useCallback((title, message, action, isDanger = false) => {
        setConfirmConfig({
            title, message, isDanger,
            onConfirm: async () => { setConfirmConfig(null); await action(); },
            onCancel:  () => setConfirmConfig(null),
        });
    }, []);

    // ── Hooks ──────────────────────────────────────────────────────────────────
    const { modals, toggleModal } = useModals();
    const { isOnline }            = useOnlineStatus(showNotification);
    const { supportsPWA, installApp, updateAvailable } = usePWA();

    // Contextos
    const { user, userData, authLoading, loginError, setLoginError, login, register, logout, resetPassword } = useAuthContext();
    const {
        products, categories, subcategories, customers, expenses, storeProfile,
        addProduct, updateProduct, deleteProduct, addStock,
        addCategory, deleteCategory, updateCategory,
        addSubCategory, deleteSubCategory,
        addCustomer, updateCustomer, deleteCustomer,
        addExpense, deleteExpense,
        updateStoreProfile, generateInvitationCode, registerFaultyProduct, bulkUpdatePrices,
    } = useInventoryContext();
    const { transactions, createTransaction, updateTransaction, deleteTransaction, purgeTransactions, balance, dateRange, setDateRange } = useTransactionsContext();
    const { cart, addToCart, updateCartQty, setCartItemQty, removeFromCart, clearCart, cartTotal, paymentMethod, setPaymentMethod } = useCartContext();
    const printer = usePrinter(showNotification);

    // ── Estados UI locales ─────────────────────────────────────────────────────
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [editingTransaction, setEditingTransaction]   = useState(null);
    const [faultyProduct, setFaultyProduct]             = useState(null);
    const [editingProduct, setEditingProduct]           = useState(null);
    const [editingCustomer, setEditingCustomer]         = useState(null);
    const [selectedCustomer, setSelectedCustomer]       = useState(null);

    const [searchTerm, setSearchTerm]                   = useState('');
    const [selectedCategory, setSelectedCategory]       = useState('all');
    const [customerSearch, setCustomerSearch]           = useState('');
    const [barcodeInput, setBarcodeInput]               = useState('');
    const [historySection, setHistorySection]           = useState('paid'); // 'menu' dejaba la lista vacía al entrar

    // ── Hooks funcionales ──────────────────────────────────────────────────────
    const { isSyncing, pendingCount: offlinePendingCount, setPendingCount } = useSyncManager({
        user, createTransaction, showNotification,
    });

    const {
        isProcessing, setIsProcessing,
        lastSale, showCheckoutSuccess, setShowCheckoutSuccess,
        checkoutError, setCheckoutError,
        handleCheckout,
    } = useCheckout({
        user, userData, cart, products, cartTotal, paymentMethod,
        selectedCustomer, createTransaction, clearCart,
        onOfflineSaved: () => setPendingCount(n => n + 1),
    });

    const { generateShoppingListPDF, handleExportData } = useExports({
        products, categories, transactions, expenses, balance, storeProfile,
        dashboardDateRange: dateRange, purgeTransactions, showNotification,
        requestConfirm, setIsProcessing,
    });

    const {
        imageMode,    setImageMode,
        previewImage, setPreviewImage,
        handleSaveProductWrapper,
        handleFileChange,
    } = useProductForm({
        editingProduct,
        addProduct, updateProduct,
        toggleModal, showNotification,
        setIsProcessing, setEditingProduct,
    });

    const {
        scannedProduct, setScannedProduct, clearScannedProduct,
        isScanning,
        barcodeInput:        inventoryBarcodeInput,
        setBarcodeInput:     setInventoryBarcodeInput,
        handleBarcodeSubmit: handleInventoryBarcodeSubmit,
        quantityInputRef,
    } = useInventoryScanner({
        products,
        activeTab,
        toggleModal, showNotification, requestConfirm,
        setEditingProduct,
    });

    useNotifications(user, userData);

    // ── Pedidos pendientes para badge ──────────────────────────────────────────
    // useMemo evita recalcular el filtro en cada render cuando transactions no cambió
    const pendingOrders = useMemo(() =>
        transactions.filter(t =>
            t.clientRole === 'client' && t.fulfillmentStatus === 'pending'
        ),
    [transactions]);
    const prevOrdersCount = useRef(pendingOrders.length);
    useEffect(() => {
        if (userData?.role === 'admin' && pendingOrders.length > prevOrdersCount.current) {
            showNotification("🔔 ¡Nuevo pedido de cliente!");
        }
        prevOrdersCount.current = pendingOrders.length;
    }, [pendingOrders.length, userData?.role]);

    // ── Botón "Atrás" del celular ──────────────────────────────────────────────
    useEffect(() => {
        const handler = () => { if (selectedTransaction) setSelectedTransaction(null); };
        window.addEventListener('popstate', handler);
        return () => window.removeEventListener('popstate', handler);
    }, [selectedTransaction]);

    // ── Handlers de modales ────────────────────────────────────────────────────
    const handleSaveExpense = async (e) => {
        e.preventDefault();
        // ✅ FIX: trim + validación de amount antes de persistir
        const description = e.target.description.value.trim().slice(0, 300);
        const amount = parseFloat(e.target.amount.value);
        if (!description) { showNotification("⚠️ Descripción requerida."); return; }
        if (isNaN(amount) || amount <= 0) { showNotification("⚠️ Monto inválido."); return; }
        try {
            await addExpense({ description, amount });
            toggleModal('expense', false);
        } catch { showNotification("❌ Error al guardar gasto"); }
    };

    const handleSaveCustomer = async (e) => {
        e.preventDefault();
        // ✅ FIX: trim + límite de longitud en todos los campos de texto libre
        // para evitar que se persistan valores vacíos o cadenas de longitud arbitraria.
        const d = {
            name:    e.target.name.value.trim().slice(0, 100),
            phone:   e.target.phone.value.trim().slice(0, 20),
            address: e.target.address.value.trim().slice(0, 300),
            email:   e.target.email.value.trim().toLowerCase().slice(0, 100),
        };
        if (!d.name) { showNotification("⚠️ El nombre del cliente es requerido."); return; }
        try {
            if (editingCustomer) await updateCustomer(editingCustomer.id, d);
            else                 await addCustomer(d);
            toggleModal('customer', false);
        } catch { showNotification("❌ Error al guardar cliente"); }
    };

    const handleSaveStore = async (e) => {
        e.preventDefault();
        const form = e.target;
        let newLogo = storeProfile.logoUrl;
        if (imageMode === 'file') { if (previewImage) newLogo = previewImage; }
        else { if (form.logoUrlLink) newLogo = form.logoUrlLink.value; }
        try {
            await updateStoreProfile({ name: form.storeName.value, logoUrl: newLogo });
            toggleModal('store', false);
            showNotification("✅ Perfil actualizado");
        } catch (err) { showNotification("❌ Error al guardar: " + err.message); }
    };

    const handleAddStock = async (e) => {
        e.preventDefault();
        await addStock(scannedProduct, parseInt(e.target.qty.value));
        toggleModal('stock', false);
        clearScannedProduct();
    };

    const handleSaveTransaction = async (d) => {
        if (!d.items || d.items.length === 0 || d.total === 0) { showNotification("⚠️ Los datos de la boleta aún no han cargado."); return; }
        setIsProcessing(true);
        try {
            await updateTransaction(editingTransaction.id, d);
            toggleModal('transaction', false);
            showNotification("✅ Boleta actualizada");
            if (selectedTransaction?.id === editingTransaction.id) setSelectedTransaction(prev => ({ ...prev, ...d }));
        } catch { showNotification("❌ No se pudieron guardar los cambios."); }
        finally   { setIsProcessing(false); }
    };

    const handleConfirmLogout  = async () => { await logout(); toggleModal('logout', false); };
    const handleConfirmFaulty  = async (p, q, r) => {
        setIsProcessing(true);
        await registerFaultyProduct(p, q, r);
        toggleModal('faulty', false);
        setIsProcessing(false);
        showNotification("✅ Falla registrada como gasto");
    };

    // ── Pantallas de carga y login ─────────────────────────────────────────────
    if (authLoading) return <LoadingScreen storeProfile={storeProfile} isOnline={isOnline} />;
    if (!user || !userData) return (
        <LoginScreen
            storeProfile={storeProfile}
            login={login} register={register}
            resetPassword={resetPassword}
            loginError={loginError} setLoginError={setLoginError}
            showNotification={showNotification}
        />
    );

    // ── UI Principal ───────────────────────────────────────────────────────────
    return (
        <div className="flex h-screen bg-[#F5F0E8] overflow-hidden relative">
            <Sidebar
                user={user} userData={userData} storeProfile={storeProfile}
                activeTab={activeTab} setActiveTab={setActiveTab}
                onLogout={() => toggleModal('logout', true)}
                onEditStore={() => toggleModal('store', true)}
                supportsPWA={supportsPWA} installApp={installApp}
                pendingCount={pendingOrders.length}
                offlinePendingCount={offlinePendingCount}
            />

            {!isOnline && (
                <div className="fixed bottom-[4.5rem] left-0 right-0 text-white text-[11px] font-black py-1.5 text-center z-[2000] flex items-center justify-center gap-1.5" style={{ background: 'linear-gradient(90deg,#f97316,#ea580c)' }}>
                    <WifiOff size={11} /> SIN CONEXIÓN — MODO OFFLINE
                </div>
            )}

            {notification && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl z-[99999] animate-in slide-in-from-top-10 fade-in flex items-center gap-3">
                    <Bell size={18} className="text-yellow-400" />
                    <span className="font-bold text-sm">{notification}</span>
                </div>
            )}

            {updateAvailable && (
                <div className="fixed top-0 left-0 right-0 z-[99999] flex items-center justify-center gap-3 py-3 px-4 text-white text-sm font-bold animate-in slide-in-from-top" style={{ background: 'linear-gradient(90deg,#f97316,#ea580c)' }}>
                    <div className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin shrink-0" />
                    Actualizando app a la nueva versión...
                </div>
            )}

            {isProcessing && <ProcessingModal />}

            <div className="flex flex-col flex-1 min-w-0 h-full">
                <header className="mobile-header-safe lg:hidden px-4 pb-3 pt-3 flex justify-between items-center z-[50] shrink-0" style={{ background: 'var(--sidebar-bg)' }}>
                    <button onClick={() => userData.role === 'admin' && toggleModal('store', true)} className="flex items-center gap-2.5 truncate">
                        <div className="w-7 h-7 rounded-lg overflow-hidden ring-1 ring-orange-500/30 flex items-center justify-center bg-orange-500/20 shrink-0">
                            {storeProfile.logoUrl ? <img src={storeProfile.logoUrl} className="w-full h-full object-cover" alt="logo" /> : <Store size={14} className="text-orange-400" />}
                        </div>
                        <span className="text-white font-bold text-sm truncate">{storeProfile.name}</span>
                    </button>
                    <button onClick={() => toggleModal('logout', true)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                        <LogOut size={17} className="text-white/40" />
                    </button>
                </header>

                <main className="flex-1 overflow-hidden relative z-0 flex flex-col bg-[#F5F0E8]">

                    {/* POS */}
                    {activeTab === 'pos' && (
                        <div className="flex flex-col h-full lg:flex-row gap-4 overflow-hidden relative p-4 pb-20 lg:pb-4">
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
                                <button onClick={() => setShowMobileCart(true)} className="lg:hidden absolute bottom-[5.5rem] left-4 right-4 text-white p-4 rounded-xl shadow-2xl flex justify-between items-center z-[55] animate-in fade-in zoom-in btn-accent">
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
                                products={products}
                            />
                        </Suspense>
                    )}

                    {/* Pedidos */}
                    {activeTab === 'orders' && userData.role === 'admin' && (
                        <Suspense fallback={<TabLoader />}>
                            <Orders />
                        </Suspense>
                    )}

                    {/* Reparto */}
                    {activeTab === 'delivery' && userData.role === 'admin' && (
                        <div className="flex-1 overflow-hidden p-4 pb-24 lg:pb-4">
                            <Suspense fallback={<TabLoader />}>
                                <Delivery />
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
                                    <button onClick={() => toggleModal('bulkPrices', true)} className="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-2 rounded-lg text-sm font-bold flex gap-1 hover:bg-blue-100 transition-colors"><TrendingUp size={16} /> Precios</button>
                                    <button onClick={() => toggleModal('shoppingList', true)} className="bg-yellow-50 text-yellow-700 border border-yellow-200 px-3 py-2 rounded-lg text-sm font-bold flex gap-1 hover:bg-yellow-100 transition-colors"><ClipboardList size={16} /> Faltantes</button>
                                    <button onClick={() => { setEditingProduct(null); setPreviewImage(''); toggleModal('product', true); }} className="btn-accent px-3 py-2 text-sm font-bold flex gap-1 items-center"><Plus size={16} /> Prod</button>
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
                            {/* Header */}
                            <div className="flex justify-between items-center mb-3 flex-shrink-0">
                                <h2 className="text-xl font-bold text-[#3D2B1F]">
                                    Clientes
                                    <span className="ml-2 text-sm font-normal text-[#8B6914]">({customers.length})</span>
                                </h2>
                                <div className="flex gap-2">
                                    <button onClick={() => toggleModal('invitation', true)} className="bg-[#E8E0CC] text-[#5C4A2A] px-3 py-2 rounded-lg text-sm font-medium flex gap-1 items-center hover:bg-[#D4C9B0] transition-colors"><KeyRound size={16} /> Invitación</button>
                                    <button onClick={() => { setEditingCustomer(null); toggleModal('customer', true); }} className="btn-accent px-3 py-2 text-sm font-bold flex gap-1 items-center"><Plus size={16} /> Cliente</button>
                                </div>
                            </div>
                            {/* Buscador */}
                            <div className="mb-3 flex-shrink-0">
                                <div className="flex items-center gap-2 bg-[#EDE8DC] border border-[#D4C9B0] rounded-xl px-3 py-2.5 focus-within:border-[#8B6914] transition-colors">
                                    <Search size={16} className="text-[#8B6914] shrink-0" />
                                    <input
                                        className="w-full text-sm outline-none bg-transparent placeholder:text-[#A09070] text-[#3D2B1F]"
                                        placeholder="Buscar por nombre, teléfono o dirección..."
                                        value={customerSearch}
                                        onChange={(e) => setCustomerSearch(e.target.value)}
                                    />
                                    {customerSearch && (
                                        <button onClick={() => setCustomerSearch('')} className="text-[#A09070] hover:text-[#3D2B1F] shrink-0">✕</button>
                                    )}
                                </div>
                            </div>
                            {/* Lista */}
                            <div className="flex-1 overflow-y-auto rounded-xl border border-[#D4C9B0] divide-y divide-[#E8E0CC] bg-[#EDE8DC]">
                                {customers
                                    .filter(c =>
                                        !customerSearch ||
                                        c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
                                        c.phone?.includes(customerSearch) ||
                                        c.address?.toLowerCase().includes(customerSearch.toLowerCase())
                                    )
                                    .map(c => (
                                    <div key={c.id} className="p-4 flex justify-between items-center hover:bg-[#F5F0E8] transition-colors">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-9 h-9 rounded-full bg-[#8B6914]/15 border border-[#8B6914]/20 flex items-center justify-center shrink-0">
                                                <span className="text-sm font-black text-[#8B6914]">{c.name?.charAt(0).toUpperCase()}</span>
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-[#3D2B1F] truncate">{c.name}</div>
                                                <div className="text-xs text-[#7A6040] flex items-center gap-2">
                                                    {c.phone && <span>{c.phone}</span>}
                                                    {c.phone && c.address && <span>·</span>}
                                                    {c.address && <span className="truncate max-w-[160px]">{c.address}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            <button onClick={() => { setEditingCustomer(c); toggleModal('customer', true); }} className="text-[#8B6914] text-xs font-bold border border-[#8B6914]/30 bg-[#8B6914]/10 px-3 py-1.5 rounded-lg hover:bg-[#8B6914]/20 transition-colors">Editar</button>
                                            <button onClick={() => requestConfirm("Borrar Cliente", "¿Seguro?", () => deleteCustomer(c.id), true)} className="text-red-600 text-xs font-bold border border-red-200 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors">Borrar</button>
                                        </div>
                                    </div>
                                ))}
                                {customers.filter(c =>
                                    !customerSearch ||
                                    c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
                                    c.phone?.includes(customerSearch) ||
                                    c.address?.toLowerCase().includes(customerSearch.toLowerCase())
                                ).length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-16 text-[#A09070]">
                                        <span className="text-4xl mb-3">🔍</span>
                                        <p className="text-sm font-medium">No se encontraron clientes</p>
                                        <p className="text-xs mt-1">Probá con otro término de búsqueda</p>
                                    </div>
                                )}
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
                        offlinePendingCount={offlinePendingCount}
                    />
                )}

                {selectedTransaction && (
                    <Suspense fallback={<ProcessingModal />}>
                        <TransactionDetail
                            transaction={selectedTransaction}
                            onClose={() => { setSelectedTransaction(null); if (window.history.state) window.history.back(); }}
                            printer={printer} storeProfile={storeProfile} customers={customers}
                            onEditItems={(t) => { setEditingTransaction(t); toggleModal('transaction', true); }}
                            userData={userData}
                            showNotification={showNotification}
                        />
                    </Suspense>
                )}

                {showCheckoutSuccess && (
                    <div className="fixed top-20 right-4 bg-green-600 text-white px-6 py-4 rounded-lg shadow-xl animate-bounce z-[105] flex items-center gap-4">
                        <div className="flex flex-col">
                            <p className="font-bold text-sm">¡Venta Guardada!</p>
                            <p className="text-[10px] opacity-80">✅ Guardada en servidor</p>
                        </div>
                        <button
                            onClick={() => {
                                if (lastSale) { setSelectedTransaction(lastSale); setActiveTab('transactions'); window.history.pushState({ view: 't' }, ''); }
                                setShowCheckoutSuccess(false);
                            }}
                            className="bg-white text-green-600 px-3 py-1 rounded text-xs font-bold hover:bg-green-50"
                        >Ver Boleta</button>
                    </div>
                )}

                {isSyncing && (
                    <div className="fixed inset-0 z-[99998] flex flex-col items-center justify-center" style={{ background: 'rgba(17,24,39,0.92)', backdropFilter: 'blur(6px)' }}>
                        <div className="bg-white/10 border border-white/20 rounded-3xl p-8 flex flex-col items-center gap-5 max-w-xs mx-4 text-center shadow-2xl">
                            <div className="relative w-16 h-16">
                                <div className="absolute inset-0 border-4 border-white/10 rounded-full" />
                                <div className="absolute inset-0 border-4 border-orange-500 rounded-full border-t-transparent animate-spin" />
                            </div>
                            <div>
                                <p className="text-white font-black text-lg">Sincronizando boletas</p>
                                <p className="text-white/50 text-sm mt-1">Subiendo pedidos guardados offline...</p>
                                <p className="text-white/30 text-xs mt-3">No cerrés la app hasta que termine</p>
                            </div>
                        </div>
                    </div>
                )}

                {checkoutError && (
                    <div className={`fixed inset-x-4 bottom-[5.5rem] lg:inset-x-auto lg:right-4 lg:bottom-6 lg:w-96 text-white px-5 py-4 rounded-xl shadow-2xl z-[99997] border-2 ${checkoutError.isPendingSync ? 'bg-amber-600 border-amber-400' : 'bg-red-600 border-red-400'}`}>
                        <div className="flex items-start justify-between gap-3 mb-3">
                            <div>
                                <p className="font-bold text-base">
                                    {checkoutError.isPendingSync ? '⏳ Pedido guardado — sin sincronizar' : checkoutError.isStorageFull ? '💾 Almacenamiento lleno' : checkoutError.isOffline ? '📶 Sin conexión' : '⚠️ Error al registrar pedido'}
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
                                : checkoutError.isStorageFull
                                    ? 'El almacenamiento del dispositivo está lleno. Sincronizá los pedidos pendientes y liberá espacio antes de continuar.'
                                    : checkoutError.isOffline
                                        ? 'Necesitás internet para enviar pedidos. Conectate y repetí el pedido.'
                                        : 'Anotá el pedido manualmente y avisá al administrador.'}
                        </p>
                    </div>
                )}
            </div>

            <AppModals
                modals={modals}             toggleModal={toggleModal}
                confirmConfig={confirmConfig}
                editingProduct={editingProduct}
                imageMode={imageMode}       setImageMode={setImageMode}
                previewImage={previewImage} setPreviewImage={setPreviewImage}
                handleFileChange={handleFileChange}
                handleSaveProductWrapper={handleSaveProductWrapper}
                categories={categories}    subcategories={subcategories}
                setFaultyProduct={setFaultyProduct}
                deleteProduct={deleteProduct}
                requestConfirm={requestConfirm}
                addSubCategory={addSubCategory}   deleteSubCategory={deleteSubCategory}
                updateCategory={updateCategory}   deleteCategory={deleteCategory}
                addCategory={addCategory}
                editingCustomer={editingCustomer}
                handleSaveCustomer={handleSaveCustomer}
                storeProfile={storeProfile}
                handleSaveStore={handleSaveStore}
                scannedProduct={scannedProduct}   setScannedProduct={clearScannedProduct}
                handleAddStock={handleAddStock}   quantityInputRef={quantityInputRef}
                editingTransaction={editingTransaction}
                handleSaveTransaction={handleSaveTransaction}
                handleConfirmLogout={handleConfirmLogout}
                generateInvitationCode={generateInvitationCode}
                faultyProduct={faultyProduct}
                handleConfirmFaulty={handleConfirmFaulty}
                handleSaveExpense={handleSaveExpense}
                showNotification={showNotification}
                generateShoppingListPDF={generateShoppingListPDF}
                bulkUpdatePrices={bulkUpdatePrices}
                products={products}
            />
        </div>
    );
}
