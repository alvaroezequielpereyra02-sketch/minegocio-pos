import React, { useState, useEffect, lazy, Suspense, useRef } from 'react';
import { Store, KeyRound, Plus, LogOut, ShoppingCart, Bell, WifiOff, Tags } from 'lucide-react';
// ✅ FIX: Importación necesaria para handleCheckout
import { serverTimestamp } from 'firebase/firestore';

// --- IMPORTS DE CONTEXTOS ---
import { useAuthContext } from './context/AuthContext';
import { useInventoryContext } from './context/InventoryContext';
import { useTransactionsContext } from './context/TransactionsContext';
import { useCartContext } from './context/CartContext';

// --- HOOKS DE UI Y UTILIDADES ---
import { usePrinter } from './hooks/usePrinter';
import { usePWA } from './hooks/usePWA';
import { uploadProductImage } from './utils/uploadImage';

// --- COMPONENTES ---
import Sidebar, { MobileNav } from './components/Sidebar';
import Cart from './components/Cart';
import ProductGrid from './components/ProductGrid';
import { ExpenseModal, ProductModal, CategoryModal, CustomerModal, StoreModal, AddStockModal, TransactionModal, LogoutConfirmModal, InvitationModal, ProcessingModal, ConfirmModal } from './components/Modals';

// --- LAZY LOADING ---
const Dashboard = lazy(() => import('./components/Dashboard'));
const History = lazy(() => import('./components/History'));
const TransactionDetail = lazy(() => import('./components/TransactionDetail'));
const Orders = lazy(() => import('./components/Orders'));
const Delivery = lazy(() => import('./components/Delivery'));

const TabLoader = () => (
  <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 animate-in fade-in zoom-in">
    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
    <span className="text-xs font-bold">Cargando...</span>
  </div>
);

const compressImage = (file, maxWidth = 500, quality = 0.7) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
    };
  });
};

export default function App() {
  const [activeTab, setActiveTab] = useState('pos');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [notification, setNotification] = useState(null);
  const [confirmConfig, setConfirmConfig] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(false);

  const { supportsPWA, installApp } = usePWA();

  const [dashboardDateRange, setDashboardDateRange] = useState('week');

  const [modals, setModals] = useState({
    product: false, category: false, customer: false, transaction: false,
    store: false, stock: false, expense: false, logout: false, invitation: false
  });
  const toggleModal = (name, value) => setModals(prev => ({ ...prev, [name]: value }));

  // --- CONSUMIR CONTEXTOS ---
  const { user, userData, authLoading, loginError, setLoginError, login, register, logout, resetPassword } = useAuthContext();

  const {
    products, categories, subcategories, customers, expenses, storeProfile,
    addProduct, updateProduct, deleteProduct, addStock,
    addCategory, deleteCategory, updateCategory,
    addSubCategory, deleteSubCategory,
    addCustomer, updateCustomer, deleteCustomer,
    addExpense, deleteExpense,
    updateStoreProfile, generateInvitationCode
  } = useInventoryContext();

  const {
    transactions, lastTransactionId, createTransaction, updateTransaction, deleteTransaction, purgeTransactions, balance
  } = useTransactionsContext();

  const {
    cart, addToCart, updateCartQty, setCartItemQty, removeFromCart, clearCart, cartTotal, paymentMethod, setPaymentMethod
  } = useCartContext();

  const printer = usePrinter();

  // Estados locales de UI
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [scannedProduct, setScannedProduct] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [customerSearch, setCustomerSearch] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [inventoryBarcodeInput, setInventoryBarcodeInput] = useState('');
  const [imageMode, setImageMode] = useState('link');
  const [previewImage, setPreviewImage] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [historySection, setHistorySection] = useState('menu');

  const quantityInputRef = useRef(null);

  // Escuchar el botón "Atrás" del navegador
  useEffect(() => {
    const handlePopState = (event) => {
      if (selectedTransaction) {
        setSelectedTransaction(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedTransaction]);

  useEffect(() => {
    const handleStatus = () => {
      setIsOnline(navigator.onLine);
      if (navigator.onLine) showNotification("🟢 Conexión restaurada");
      else showNotification("🔴 Sin conexión (Modo Offline)");
    };
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => { window.removeEventListener('online', handleStatus); window.removeEventListener('offline', handleStatus); };
  }, []);

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleExportData = () => {
    if (transactions.length === 0) return alert("No hay datos para exportar.");
    try {
      let csvContent = "\uFEFF";
      csvContent += `REPORTE GENERAL (${dashboardDateRange === 'week' ? 'Últimos 7 días' : 'Últimos 30 días'})\n`;
      csvContent += `Generado el,${new Date().toLocaleString()}\n\n`;
      csvContent += "METRICAS DEL PERIODO\n";
      csvContent += `Ventas Totales,$${balance.periodSales}\n`;
      csvContent += `Gastos Operativos,-$${balance.periodExpenses}\n`;
      csvContent += `Costo Mercadería,-$${balance.periodCost}\n`;
      csvContent += `GANANCIA NETA,$${balance.periodNet}\n\n`;
      csvContent += "VENTAS POR CATEGORIA\n";
      csvContent += "Categoría,Monto Vendido\n";
      balance.salesByCategory.forEach(cat => { csvContent += `${cat.name},$${cat.value}\n`; });
      csvContent += "\n";
      csvContent += "GASTOS DETALLADOS\n";
      csvContent += "Fecha,Descripción,Monto\n";
      expenses.forEach(e => { csvContent += `${new Date(e.date?.seconds * 1000).toLocaleDateString()},${e.description},${e.amount}\n`; });
      csvContent += "\n";
      csvContent += "DETALLE DE TRANSACCIONES\n";
      csvContent += "Fecha,Cliente,Estado,Método,Total,Pagado,Items\n";
      transactions.forEach(t => {
        const date = new Date(t.date?.seconds * 1000).toLocaleString();
        const itemsStr = t.items?.map(i => `${i.qty}x ${i.name}`).join(' | ');
        const safeItems = `"${itemsStr.replace(/"/g, '""')}"`;
        csvContent += `${date},${t.clientName},${t.paymentStatus},${t.paymentMethod},${t.total},${t.amountPaid || 0},${safeItems}\n`;
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Reporte_Completo_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        requestConfirm("¿Limpiar Base de Datos?", "✅ Reporte descargado.\n\n¿Quieres borrar el historial de ventas y gastos para liberar espacio?\nEsto NO borra productos ni clientes.", async () => {
          setIsProcessing(true);
          await purgeTransactions();
          setIsProcessing(false);
          showNotification("🧹 Historial limpiado");
        }, true);
      }, 1500);
    } catch (error) { console.error("Error exportando:", error); alert("Error al generar el reporte."); }
  };

  const handleCheckout = async () => {
    if (!user || cart.length === 0) return;
    setIsProcessing(true);
    let finalClient = { id: 'anonimo', name: 'Anónimo', role: 'guest' };
    if (userData?.role === 'admin' && selectedCustomer) finalClient = { id: selectedCustomer.id, name: selectedCustomer.name, role: 'customer' };
    else if (userData?.role === 'client') finalClient = { id: user.uid, name: userData.name, role: 'client' };

    const itemsWithCost = cart.map(i => {
      const p = products.find(prod => prod.id === i.id);
      return { ...i, cost: p ? (p.cost || 0) : 0 };
    });

    const saleData = {
      type: 'sale', total: cartTotal, amountPaid: 0, items: itemsWithCost,
      date: serverTimestamp(),
      clientId: finalClient.id, clientName: finalClient.name,
      clientRole: finalClient.role, sellerId: user.uid, paymentStatus: 'pending',
      paymentNote: '', paymentMethod: paymentMethod, fulfillmentStatus: 'pending'
    };

    try {
      await createTransaction(saleData, cart);
      clearCart();
      setSelectedCustomer(null);
      setShowMobileCart(false);
      setIsProcessing(false);
      setShowCheckoutSuccess(true);
      setTimeout(() => setShowCheckoutSuccess(false), 4000);
    } catch (e) { console.error(e); alert("Error al procesar venta"); setIsProcessing(false); }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      if (isRegistering) {
        const registerData = {
          name: form.name.value, phone: form.phone.value, address: form.address.value, email: form.email.value, password: form.password.value, inviteCode: form.inviteCode ? form.inviteCode.value : ''
        };
        await register(registerData);
      } else { await login(form.email.value, form.password.value); }
    } catch (e) { console.error("Error autenticación:", e); }
  };

  const requestConfirm = (title, message, action, isDanger = false) => {
    setConfirmConfig({ title, message, onConfirm: async () => { setConfirmConfig(null); await action(); }, onCancel: () => setConfirmConfig(null), isDanger });
  };

  const handleSaveProductWrapper = async (e) => {
    e.preventDefault();
    const f = e.target;
    const rawImage = imageMode === 'file' ? previewImage : (f.imageUrlLink?.value || '');

    setIsProcessing(true);

    try {
      const finalImageUrl = await uploadProductImage(rawImage, f.name.value);

      const data = {
        name: f.name.value, barcode: f.barcode.value, price: parseFloat(f.price.value),
        cost: parseFloat(f.cost.value || 0), stock: parseInt(f.stock.value),
        categoryId: f.category.value, subCategoryId: f.subcategory.value, imageUrl: finalImageUrl || ''
      };

      if (editingProduct) await updateProduct(editingProduct.id, data);
      else await addProduct(data);

      toggleModal('product', false);
      showNotification("✅ Producto guardado");
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInventoryBarcodeSubmit = (e) => {
    e.preventDefault();
    if (!inventoryBarcodeInput) return;
    const p = products.find(p => p.barcode === inventoryBarcodeInput);
    if (p) { setScannedProduct(p); toggleModal('stock', true); setTimeout(() => quantityInputRef.current?.focus(), 100); }
    else { requestConfirm("Producto no existe", "¿Crear nuevo?", () => { setEditingProduct({ barcode: inventoryBarcodeInput }); toggleModal('product', true); }); }
    setInventoryBarcodeInput('');
  };

  const handleFileChange = async (e) => {
    const f = e.target.files[0];
    if (f) {
      if (f.size > 5 * 1024 * 1024) return alert("Imagen muy pesada (Máx 5MB)");
      setIsProcessing(true);
      const base64 = await compressImage(f);
      setPreviewImage(base64);
      setIsProcessing(false);
    }
  };

  if (authLoading) return <div className="h-screen flex items-center justify-center bg-slate-50 text-blue-600 font-bold">Cargando Sistema...</div>;

  if (!user || !userData) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
          <div className="text-center mb-6">
            {storeProfile.logoUrl ? <img src={storeProfile.logoUrl} className="w-16 h-16 mx-auto mb-2 rounded-xl object-cover" /> : <Store className="mx-auto text-blue-600 mb-2" size={48} />}
            <h1 className="text-2xl font-bold text-slate-800">{storeProfile.name}</h1>
          </div>
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {isRegistering && (
              <>
                <input name="name" required className="w-full p-3 border rounded-lg" placeholder="Nombre" />
                <div className="grid grid-cols-2 gap-2"><input name="phone" required className="w-full p-3 border rounded-lg" placeholder="Teléfono" /><input name="address" required className="w-full p-3 border rounded-lg" placeholder="Dirección" /></div>
                <input name="inviteCode" required className="w-full p-2 border rounded-lg text-center font-bold uppercase" placeholder="CÓDIGO INVITACIÓN" />
              </>
            )}
            <input name="email" type="email" required className="w-full p-3 border rounded-lg" placeholder="Correo" />
            <input name="password" type="password" required className="w-full p-3 border rounded-lg" placeholder="Contraseña" />
            {loginError && <div className="text-red-500 text-sm text-center">{loginError}</div>}
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg">{isRegistering ? 'Registrarse' : 'Entrar'}</button>
          </form>
          <button onClick={() => setIsRegistering(!isRegistering)} className="w-full mt-4 text-blue-600 text-sm font-medium hover:underline">{isRegistering ? 'Volver al Login' : 'Crear Cuenta'}</button>
          {!isRegistering && <button onClick={() => { const e = document.querySelector('input[name="email"]').value; resetPassword(e).then(() => alert("Correo enviado")).catch(e => setLoginError(e.message)); }} className="w-full mt-2 text-slate-400 text-xs hover:text-slate-600">Olvidé contraseña</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-900 overflow-hidden relative">
      <Sidebar
        user={user} userData={userData} storeProfile={storeProfile} activeTab={activeTab} setActiveTab={setActiveTab}
        onLogout={() => toggleModal('logout', true)} onEditStore={() => toggleModal('store', true)}
        supportsPWA={supportsPWA} installApp={installApp}
      />

      {/* 👇 CAMBIO CLAVE: bottom-24 (96px) para que flote por encima de la barra de 80px */}
      {!isOnline && <div className="fixed bottom-24 left-0 right-0 bg-slate-800 text-white text-xs font-bold py-1 text-center z-[2000] animate-pulse opacity-90"><WifiOff size={12} className="inline mr-1" /> OFFLINE</div>}

      {confirmConfig && <ConfirmModal title={confirmConfig.title} message={confirmConfig.message} onConfirm={confirmConfig.onConfirm} onCancel={confirmConfig.onCancel} isDanger={confirmConfig.isDanger} />}
      {notification && <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl z-[1000] animate-in slide-in-from-top-10 fade-in flex items-center gap-3"><Bell size={18} className="text-yellow-400" /><span className="font-bold text-sm">{notification}</span></div>}
      {isProcessing && <ProcessingModal />}

      <div className="flex flex-col flex-1 min-w-0 h-full">
        <header className="lg:hidden bg-white shadow-sm border-b px-4 py-3 flex justify-between items-center z-[50] shrink-0 h-16">
          <button onClick={() => userData.role === 'admin' && toggleModal('store', true)} className="flex items-center gap-2 font-bold text-lg text-slate-800 truncate">
            {storeProfile.logoUrl ? <img src={storeProfile.logoUrl} className="w-8 h-8 object-cover rounded" /> : <Store className="text-blue-600" />} <span>{storeProfile.name}</span>
          </button>
          <button onClick={() => toggleModal('logout', true)} className="bg-slate-100 p-2 rounded-full"><LogOut size={18} /></button>
        </header>

        <main className="flex-1 overflow-hidden p-4 relative z-0 flex flex-col">
          {activeTab === 'pos' && (
            <div className="flex flex-col h-full lg:flex-row gap-4 overflow-hidden relative">
              <ProductGrid products={products} addToCart={addToCart} searchTerm={searchTerm} setSearchTerm={setSearchTerm} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} categories={categories} subcategories={subcategories} userData={userData} barcodeInput={barcodeInput} setBarcodeInput={setBarcodeInput} handleBarcodeSubmit={(e) => { e.preventDefault(); if (!barcodeInput) return; const p = products.find(x => x.barcode === barcodeInput); if (p) { addToCart(p); setBarcodeInput(''); } else alert("No encontrado"); }} />
              <div className="hidden lg:block w-80 rounded-xl shadow-lg border border-slate-200 overflow-hidden"><Cart cart={cart} updateCartQty={updateCartQty} removeFromCart={removeFromCart} setCartItemQty={setCartItemQty} userData={userData} selectedCustomer={selectedCustomer} setSelectedCustomer={setSelectedCustomer} customerSearch={customerSearch} setCustomerSearch={setCustomerSearch} customers={customers} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} cartTotal={cartTotal} handleCheckout={handleCheckout} setShowMobileCart={setShowMobileCart} /></div>
              {showMobileCart && <div className="lg:hidden absolute inset-0 z-[60] bg-white flex flex-col animate-in slide-in-from-bottom"><Cart cart={cart} updateCartQty={updateCartQty} removeFromCart={removeFromCart} setCartItemQty={setCartItemQty} userData={userData} selectedCustomer={selectedCustomer} setSelectedCustomer={setSelectedCustomer} customerSearch={customerSearch} setCustomerSearch={setCustomerSearch} customers={customers} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} cartTotal={cartTotal} handleCheckout={handleCheckout} setShowMobileCart={setShowMobileCart} /></div>}

              {/* 👇 CAMBIO CLAVE: bottom-24 (96px) para que flote por encima de la barra de 80px */}
              {cart.length > 0 && !showMobileCart && <button onClick={() => setShowMobileCart(true)} className="lg:hidden absolute bottom-24 left-4 right-4 bg-blue-600 text-white p-4 rounded-xl shadow-2xl flex justify-between items-center z-[55] animate-in fade-in zoom-in"><div className="flex items-center gap-2 font-bold"><ShoppingCart size={20} /> Ver Pedido ({cart.reduce((a, b) => a + b.qty, 0)})</div><div className="font-bold text-lg">${cartTotal.toLocaleString()}</div></button>}
            </div>
          )}

          {activeTab === 'dashboard' && userData.role === 'admin' && (
            <Suspense fallback={<TabLoader />}>
              <Dashboard balance={balance} expenses={expenses} setIsExpenseModalOpen={(v) => toggleModal('expense', v)} handleDeleteExpense={(id) => requestConfirm("Borrar Gasto", "¿Seguro?", () => deleteExpense(id), true)} dateRange={dashboardDateRange} setDateRange={setDashboardDateRange} />
            </Suspense>
          )}

          {activeTab === 'orders' && userData.role === 'admin' && (
            <Suspense fallback={<TabLoader />}>
              <Orders transactions={transactions} products={products} categories={categories} onUpdateTransaction={(id, data) => updateTransaction(id, data)} onSelectTransaction={(t) => setSelectedTransaction(t)} />
            </Suspense>
          )}

          {activeTab === 'delivery' && userData.role === 'admin' && (
            <Suspense fallback={<TabLoader />}>
              <Delivery transactions={transactions} customers={customers} onUpdateTransaction={updateTransaction} onSelectTransaction={(t) => setSelectedTransaction(t)} onRequestConfirm={requestConfirm} />
            </Suspense>
          )}

          {activeTab === 'inventory' && userData.role === 'admin' && (
            <div className="flex flex-col h-full overflow-hidden lg:pb-0">
              <div className="flex justify-between items-center mb-4 flex-shrink-0">
                <h2 className="text-xl font-bold text-slate-800">Inventario</h2>
                <div className="flex gap-2">
                  <button onClick={() => toggleModal('category', true)} className="bg-slate-100 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium flex gap-1"><Tags size={16} /> Cats</button>
                  <button onClick={() => { setEditingProduct(null); setPreviewImage(''); toggleModal('product', true); }} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium flex gap-1"><Plus size={16} /> Prod</button>
                </div>
              </div>
              <ProductGrid products={products} addToCart={(p) => { setEditingProduct(p); setPreviewImage(p.imageUrl || ''); setImageMode(p.imageUrl?.startsWith('data:') ? 'file' : 'link'); toggleModal('product', true); }} searchTerm={searchTerm} setSearchTerm={setSearchTerm} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} categories={categories} subcategories={subcategories} userData={userData} barcodeInput={inventoryBarcodeInput} setBarcodeInput={setInventoryBarcodeInput} handleBarcodeSubmit={handleInventoryBarcodeSubmit} />
            </div>
          )}

          {activeTab === 'customers' && userData.role === 'admin' && (
            <div className="flex flex-col h-full overflow-hidden lg:pb-0">
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
                    <div><div className="font-bold text-slate-800">{c.name}</div><div className="text-xs text-slate-500">{c.phone}</div></div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingCustomer(c); toggleModal('customer', true); }} className="text-blue-600 text-xs font-bold border border-blue-200 bg-blue-50 px-3 py-1 rounded">Editar</button>
                      <button onClick={() => requestConfirm("Borrar Cliente", "¿Seguro?", () => deleteCustomer(c.id), true)} className="text-red-600 text-xs font-bold border border-red-200 bg-red-50 px-3 py-1 rounded">Borrar</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'transactions' && (
            <Suspense fallback={<TabLoader />}>
              <History transactions={transactions} userData={userData} handleExportCSV={handleExportData} historySection={historySection} setHistorySection={setHistorySection} onSelectTransaction={(t) => { setSelectedTransaction(t); window.history.pushState({ view: 't' }, ''); }} />
            </Suspense>
          )}
        </main>

        {!showMobileCart && !selectedTransaction && <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} userData={userData} onLogout={() => toggleModal('logout', true)} supportsPWA={supportsPWA} installApp={installApp} />}

        {selectedTransaction && (
          <Suspense fallback={<ProcessingModal />}>
            <TransactionDetail
              transaction={selectedTransaction}
              onClose={() => {
                setSelectedTransaction(null);
                if (window.history.state) window.history.back();
              }}
              printer={printer}
              storeProfile={storeProfile}
              customers={customers}
              onEditItems={(t) => { setEditingTransaction(t); toggleModal('transaction', true); }}
            />
          </Suspense>
        )}

        {modals.expense && <ExpenseModal onClose={() => toggleModal('expense', false)} onSave={async (e) => { e.preventDefault(); try { await addExpense({ description: e.target.description.value, amount: parseFloat(e.target.amount.value) }); toggleModal('expense', false); } catch (e) { alert("Error") } }} />}
        {modals.product && <ProductModal onClose={() => toggleModal('product', false)} onSave={handleSaveProductWrapper} onDelete={(id) => requestConfirm("Borrar", "¿Seguro?", () => deleteProduct(id), true)} editingProduct={editingProduct} imageMode={imageMode} setImageMode={setImageMode} previewImage={previewImage} setPreviewImage={setPreviewImage} handleFileChange={handleFileChange} categories={categories} subcategories={subcategories} />}
        {modals.category && <CategoryModal onClose={() => toggleModal('category', false)} onSave={async (e) => { e.preventDefault(); if (e.target.catName.value) { await addCategory(e.target.catName.value); toggleModal('category', false); } }} onDelete={(id) => requestConfirm("Borrar", "¿Seguro?", () => deleteCategory(id), true)} categories={categories} subcategories={subcategories} onSaveSub={addSubCategory} onDeleteSub={deleteSubCategory} onUpdate={updateCategory} />}
        {modals.customer && <CustomerModal onClose={() => toggleModal('customer', false)} onSave={async (e) => { e.preventDefault(); const d = { name: e.target.name.value, phone: e.target.phone.value, address: e.target.address.value, email: e.target.email.value }; try { if (editingCustomer) await updateCustomer(editingCustomer.id, d); else await addCustomer(d); toggleModal('customer', false); } catch (e) { alert("Error") } }} editingCustomer={editingCustomer} />}
        {modals.store && <StoreModal onClose={() => toggleModal('store', false)} storeProfile={storeProfile} imageMode={imageMode} setImageMode={setImageMode} previewImage={previewImage} setPreviewImage={setPreviewImage} handleFileChange={handleFileChange} onSave={async (e) => { e.preventDefault(); const form = e.target; const newName = form.storeName.value; let newLogo = storeProfile.logoUrl; if (imageMode === 'file') { if (previewImage) newLogo = previewImage; } else { if (form.logoUrlLink) newLogo = form.logoUrlLink.value; } try { await updateStoreProfile({ name: newName, logoUrl: newLogo }); toggleModal('store', false); showNotification("✅ Perfil actualizado"); } catch (error) { console.error(error); alert("❌ Error al guardar: " + error.message + "\n\nVerifica que tu usuario tenga rol 'admin' en la base de datos."); } }} />}
        {modals.stock && scannedProduct && <AddStockModal onClose={() => { toggleModal('stock', false); setScannedProduct(null); }} onConfirm={async (e) => { e.preventDefault(); await addStock(scannedProduct, parseInt(e.target.qty.value)); toggleModal('stock', false); setScannedProduct(null); }} scannedProduct={scannedProduct} quantityInputRef={quantityInputRef} />}
        {modals.transaction && editingTransaction && <TransactionModal onClose={() => toggleModal('transaction', false)} onSave={async (d) => { await updateTransaction(editingTransaction.id, d); toggleModal('transaction', false); if (selectedTransaction?.id === editingTransaction.id) setSelectedTransaction(prev => ({ ...prev, ...d })); }} editingTransaction={editingTransaction} />}
        {modals.logout && <LogoutConfirmModal onClose={() => toggleModal('logout', false)} onConfirm={() => { logout(); toggleModal('logout', false); setCartItemQty([]); }} />}
        {modals.invitation && <InvitationModal onClose={() => toggleModal('invitation', false)} onGenerate={generateInvitationCode} />}

        {showCheckoutSuccess && <div className="fixed top-20 right-4 bg-green-600 text-white px-6 py-4 rounded-lg shadow-xl animate-bounce z-[105] flex items-center gap-4"><div><p className="font-bold text-sm">¡Venta Exitosa!</p></div><div className="flex gap-2"><button onClick={() => { if (lastTransactionId) { printer.printRawBT(lastTransactionId, storeProfile); } setShowCheckoutSuccess(false); }} className="bg-white text-green-600 px-3 py-1 rounded text-xs font-bold hover:bg-green-50">Ticket</button></div></div>}
      </div>
    </div>
  );
}