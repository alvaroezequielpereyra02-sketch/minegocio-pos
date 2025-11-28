import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  getDoc,
  setDoc,
  deleteDoc, 
  onSnapshot, 
  serverTimestamp, 
  query, 
  orderBy,
  where 
} from 'firebase/firestore';
import { 
  LayoutDashboard, ShoppingCart, Package, History, Plus, Trash2, Minus, 
  Search, X, TrendingUp, DollarSign, Save, Image as ImageIcon, Upload, 
  Link as LinkIcon, Download, Tags, LogOut, Users, MapPin, Phone, Printer, Menu,
  Edit, CheckCircle, Clock, AlertCircle
} from 'lucide-react';

// --- CONFIGURACIÓN DE FIREBASE ---
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
  
  const [activeTab, setActiveTab] = useState('pos');
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cart, setCart] = useState([]);
  
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
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

  const [isRegistering, setIsRegistering] = useState(false);
  const [loginError, setLoginError] = useState('');

  // --- AUTENTICACIÓN ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) setUserData(userDoc.data());
        else setUserData({ name: 'Usuario', role: 'client' });
      } else {
        setUserData(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- SINCRONIZACIÓN ---
  useEffect(() => {
    if (!user || !userData) return;

    const unsubProducts = onSnapshot(query(collection(db, 'stores', appId, 'products'), orderBy('name')), (snap) => setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const unsubCats = onSnapshot(query(collection(db, 'stores', appId, 'categories'), orderBy('name')), (snap) => setCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const unsubCustomers = onSnapshot(query(collection(db, 'stores', appId, 'customers'), orderBy('name')), (snap) => setCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const unsubTrans = onSnapshot(collection(db, 'stores', appId, 'transactions'), (snapshot) => {
      let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (userData.role !== 'admin') items = items.filter(t => t.clientId === user.uid);
      items.sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));
      setTransactions(items);
    });

    return () => { unsubProducts(); unsubTrans(); unsubCats(); unsubCustomers(); };
  }, [user, userData]);

  // --- ACTIONS ---
  const handleLogin = async (e) => { e.preventDefault(); try { await signInWithEmailAndPassword(auth, e.target.email.value, e.target.password.value); } catch (error) { setLoginError("Credenciales incorrectas."); } };
  const handleRegister = async (e) => { e.preventDefault(); const form = e.target; try { const userCredential = await createUserWithEmailAndPassword(auth, form.email.value, form.password.value); const role = (form.secretCode?.value === ADMIN_SECRET_CODE) ? 'admin' : 'client'; const newUserData = { email: form.email.value, name: form.name.value, phone: form.phone.value, address: form.address.value, role, createdAt: serverTimestamp() }; await setDoc(doc(db, 'users', userCredential.user.uid), newUserData); if(role === 'client') await addDoc(collection(db, 'stores', appId, 'customers'), { name: form.name.value, phone: form.phone.value, address: form.address.value, email: form.email.value, createdAt: serverTimestamp() }); } catch (error) { setLoginError(error.message); } };
  const handleLogout = () => { signOut(auth); setCart([]); setUserData(null); };
  
  // --- IMPRESIÓN PDF CORREGIDA ---
  const handlePrintTicket = (transaction) => { 
    if (!transaction) return;
    const date = transaction.date?.seconds ? new Date(transaction.date.seconds * 1000).toLocaleString() : 'Reciente';
    const statusText = transaction.paymentStatus === 'paid' ? 'PAGADO' : transaction.paymentStatus === 'partial' ? 'PARCIAL' : 'PENDIENTE';
    
    // Abrir ventana en blanco
    const printWindow = window.open('', '_blank');
    if (!printWindow) { alert("Por favor permite las ventanas emergentes (pop-ups)"); return; }

    const htmlContent = `
      <html>
        <head>
          <title>Ticket #${transaction.id.slice(0,5)}</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 20px; font-size: 12px; width: 100%; max-width: 300px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
            .title { font-size: 16px; font-weight: bold; }
            table { width: 100%; margin-bottom: 10px; border-collapse: collapse; }
            th { text-align: left; border-bottom: 1px solid #000; }
            td { padding: 4px 0; }
            .total { text-align: right; font-size: 14px; font-weight: bold; border-top: 1px dashed #000; padding-top: 5px; }
            .status { text-align: center; font-weight: bold; margin: 10px 0; border: 1px solid #000; padding: 5px; }
            .footer { text-align: center; margin-top: 20px; font-size: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">MiNegocio POS</div>
            <div>Comprobante de Venta</div>
          </div>
          <div>
            Fecha: ${date}<br/>
            Cliente: ${transaction.clientName || 'Consumidor Final'}
          </div>
          <div class="status">ESTADO: ${statusText}</div>
          <br/>
          <table>
            <thead><tr><th>Cant</th><th>Prod</th><th>Total</th></tr></thead>
            <tbody>
              ${transaction.items.map(i => `
                <tr>
                  <td>${i.qty}</td>
                  <td>${i.name}</td>
                  <td style="text-align:right">$${i.price * i.qty}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="total">TOTAL: $${transaction.total}</div>
          ${transaction.paymentNote ? `<div style="margin-top:5px;font-style:italic">Nota: ${transaction.paymentNote}</div>` : ''}
          <div class="footer">¡Gracias por su compra!</div>
          <script>
            // Esperar a que cargue y luego imprimir
            window.onload = function() { 
                setTimeout(function() { 
                    window.print();
                    // NO cerramos la ventana automáticamente para permitir guardar PDF en móviles
                }, 500); 
            }
          </script>
        </body>
      </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close(); 
  };

  // --- CARRITO ---
  const addToCart = (product) => { if (product.stock <= 0) return; setCart(prev => { const existing = prev.find(item => item.id === product.id); return existing ? prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item) : [...prev, { ...product, qty: 1, imageUrl: product.imageUrl }]; }); };
  const updateCartQty = (id, delta) => setCart(prev => prev.map(item => item.id === id ? { ...item, qty: item.qty + delta } : item).filter(i => i.qty > 0 || i.id !== id));
  const removeFromCart = (id) => setCart(prev => prev.filter(item => item.id !== id));
  const cartTotal = useMemo(() => cart.reduce((acc, item) => acc + (item.price * item.qty), 0), [cart]);
  
  const handleCheckout = async () => { 
    if (!user || cart.length === 0) return; 
    let finalClient = { id: 'anonimo', name: 'Anónimo', role: 'guest' }; 
    if (userData.role === 'admin' && selectedCustomer) finalClient = { id: selectedCustomer.id, name: selectedCustomer.name, role: 'customer' }; 
    else if (userData.role === 'client') finalClient = { id: user.uid, name: userData.name, role: 'client' }; 
    
    const saleData = { type: 'sale', total: cartTotal, items: cart.map(i => ({ id: i.id, name: i.name, qty: i.qty, price: i.price })), date: serverTimestamp(), clientId: finalClient.id, clientName: finalClient.name, clientRole: finalClient.role, sellerId: user.uid, paymentStatus: 'paid', paymentNote: '' }; 
    
    try { 
        const docRef = await addDoc(collection(db, 'stores', appId, 'transactions'), saleData); 
        for (const item of cart) { const p = products.find(prod => prod.id === item.id); if (p) await updateDoc(doc(db, 'stores', appId, 'products', item.id), { stock: Math.max(0, p.stock - item.qty) }); } 
        setCart([]); setSelectedCustomer(null); setCustomerSearch(''); 
        setLastTransactionId({ ...saleData, id: docRef.id, date: { seconds: Date.now() / 1000 } }); 
        setShowCheckoutSuccess(true); setTimeout(() => setShowCheckoutSuccess(false), 3000);
    } catch (error) { alert("Error venta."); } 
  };

  // --- ACTUALIZAR TRANSACCIÓN (ESTADO + ITEMS) ---
  const handleUpdateTransaction = async (e) => {
    e.preventDefault();
    if (!editingTransaction) return;
    const form = e.target;
    
    // Recopilar items editados
    const updatedItems = editingTransaction.items.map((item, index) => ({
        ...item,
        name: form[`item_name_${index}`].value,
        qty: parseInt(form[`item_qty_${index}`].value),
        price: parseFloat(form[`item_price_${index}`].value)
    }));

    // Recalcular total automáticamente
    const newTotal = updatedItems.reduce((acc, item) => acc + (item.price * item.qty), 0);

    try {
        await updateDoc(doc(db, 'stores', appId, 'transactions', editingTransaction.id), {
            paymentStatus: form.paymentStatus.value,
            paymentNote: form.paymentNote.value,
            items: updatedItems,
            total: newTotal
        });
        setIsTransactionModalOpen(false);
        setEditingTransaction(null);
    } catch (error) {
        alert("Error al actualizar la boleta");
    }
  };

  // --- CRUD GESTIÓN ---
  const handleSaveCustomer = async (e) => { e.preventDefault(); const f = e.target; const d = { name: f.name.value, phone: f.phone.value, address: f.address.value, email: f.email.value }; try { if(editingCustomer) await updateDoc(doc(db, 'stores', appId, 'customers', editingCustomer.id), d); else await addDoc(collection(db, 'stores', appId, 'customers'), { ...d, createdAt: serverTimestamp() }); setIsCustomerModalOpen(false); } catch (e){alert("Error");} };
  const handleDeleteCustomer = async (id) => { if(confirm('¿Borrar?')) await deleteDoc(doc(db, 'stores', appId, 'customers', id)); };
  const handleFileChange = (e) => { const f = e.target.files[0]; if (f && f.size <= 800000) { const r = new FileReader(); r.onloadend = () => setPreviewImage(r.result); r.readAsDataURL(f); } };
  const handleExportCSV = () => { if (transactions.length === 0) return alert("No hay datos."); const csv = ["Fecha,Cliente,Estado,Total,Productos"].concat(transactions.map(t => `${new Date(t.date?.seconds*1000).toLocaleDateString()},${t.clientName},${t.paymentStatus || 'paid'},${t.total},"${t.items?.map(i=>`${i.qty} ${i.name}`).join('|')}"`)).join('\n'); const l = document.createElement('a'); l.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'})); l.download = 'ventas.csv'; l.click(); };
  const handleSaveProduct = async (e) => { e.preventDefault(); const f = e.target; const img = imageMode === 'file' ? previewImage : (f.imageUrlLink?.value || ''); const d = { name: f.name.value, price: parseFloat(f.price.value), stock: parseInt(f.stock.value), categoryId: f.category.value, imageUrl: img }; if (editingProduct) await updateDoc(doc(db, 'stores', appId, 'products', editingProduct.id), d); else await addDoc(collection(db, 'stores', appId, 'products'), { ...d, createdAt: serverTimestamp() }); setIsProductModalOpen(false); };
  const handleSaveCategory = async (e) => { if(e.target.catName.value) { await addDoc(collection(db, 'stores', appId, 'categories'), { name: e.target.catName.value, createdAt: serverTimestamp() }); setIsCategoryModalOpen(false); } };
  const handleDeleteProduct = async (id) => { if (confirm('¿Borrar?')) await deleteDoc(doc(db, 'stores', appId, 'products', id)); };
  const handleDeleteCategory = async (id) => { if(confirm('¿Borrar?')) await deleteDoc(doc(db, 'stores', appId, 'categories', id)); };
  const stats = useMemo(() => { let s=0, t=0, v=0; transactions.forEach(x=>{if(x.type==='sale' && x.paymentStatus !== 'pending'){s+=x.total;t++}}); products.forEach(p=>v+=p.price*p.stock); return {totalSales:s, totalTrans:t, inventoryValue:v}; }, [transactions, products]);
  const handleOpenModal = (p = null) => { setEditingProduct(p); setPreviewImage(p?.imageUrl||''); setImageMode(p?.imageUrl?.startsWith('data:')?'file':'link'); setIsProductModalOpen(true); };

  if (authLoading) return <div className="h-screen flex items-center justify-center bg-slate-50 text-blue-600 font-bold">Cargando...</div>;

  if (!user || !userData) { 
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
          <div className="text-center mb-6"><div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-2">M</div><h1 className="text-2xl font-bold text-slate-800">{isRegistering ? 'Crear Cuenta' : 'Acceso'}</h1></div>
          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
            {isRegistering && (<><input name="name" required className="w-full p-3 border rounded-lg" placeholder="Nombre Completo" /><div className="grid grid-cols-2 gap-2"><input name="phone" required className="w-full p-3 border rounded-lg" placeholder="Teléfono" /><input name="address" required className="w-full p-3 border rounded-lg" placeholder="Dirección" /></div><div className="pt-2 border-t mt-2"><p className="text-xs text-slate-400 mb-1">Código Admin (Solo Personal):</p><input name="secretCode" className="w-full p-2 border rounded-lg text-sm" placeholder="Dejar vacío si eres cliente" /></div></>)}
            <input name="email" type="email" required className="w-full p-3 border rounded-lg" placeholder="Correo" /><input name="password" type="password" required className="w-full p-3 border rounded-lg" placeholder="Contraseña" />
            {loginError && <div className="text-red-500 text-sm text-center">{loginError}</div>}
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg">{isRegistering ? 'Registrarse' : 'Entrar'}</button>
          </form>
          <button onClick={() => setIsRegistering(!isRegistering)} className="w-full mt-4 text-blue-600 text-sm font-medium hover:underline">{isRegistering ? 'Volver al Login' : 'Crear Cuenta'}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-100 font-sans text-slate-900 overflow-hidden">
      <header className="bg-white shadow-sm border-b px-4 py-3 flex justify-between items-center z-[100] shrink-0 h-16 relative">
        <div className="flex items-center gap-2 font-bold text-xl text-slate-800"><div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">M</div>MiNegocio</div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-bold">{userData.name}</div>
            <div className={`text-xs px-2 py-0.5 rounded-full inline-block ${userData.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>{userData.role === 'admin' ? 'Admin' : 'Cliente'}</div>
          </div>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200 lg:hidden"><Menu size={20}/></button>
          <button onClick={handleLogout} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200 hidden lg:block"><LogOut size={18}/></button>
        </div>
        {isMenuOpen && (<div className="absolute top-16 right-0 w-64 bg-white shadow-2xl border-l border-b border-slate-200 p-4 flex flex-col gap-2 z-[101]"><button onClick={()=>{setActiveTab('pos'); setIsMenuOpen(false);}} className="text-left p-3 hover:bg-blue-50 rounded flex gap-2 items-center"><LayoutDashboard size={16}/> Vender</button>{userData.role === 'admin' && (<><button onClick={()=>{setActiveTab('inventory'); setIsMenuOpen(false);}} className="text-left p-3 hover:bg-blue-50 rounded flex gap-2 items-center"><Package size={16}/> Inventario</button><button onClick={()=>{setActiveTab('customers'); setIsMenuOpen(false);}} className="text-left p-3 hover:bg-blue-50 rounded flex gap-2 items-center"><Users size={16}/> Clientes</button><button onClick={()=>{setActiveTab('dashboard'); setIsMenuOpen(false);}} className="text-left p-3 hover:bg-blue-50 rounded flex gap-2 items-center"><TrendingUp size={16}/> Balance</button></>)}<button onClick={()=>{setActiveTab('transactions'); setIsMenuOpen(false);}} className="text-left p-3 hover:bg-blue-50 rounded flex gap-2 items-center"><History size={16}/> Historial</button><div className="border-t pt-2 mt-2"><button onClick={handleLogout} className="text-left p-3 hover:bg-red-50 text-red-600 rounded flex gap-2 items-center w-full"><LogOut size={16}/> Cerrar Sesión</button></div></div>)}
      </header>

      <main className="flex-1 overflow-hidden p-4 max-w-5xl mx-auto w-full relative z-0">
        {activeTab === 'pos' && (
          <div className="flex flex-col h-full lg:flex-row gap-4 overflow-hidden">
            <div className="flex-1 flex flex-col min-h-0">
              <div className="mb-3 relative"><Search className="absolute left-3 top-3 text-slate-400 w-5 h-5" /><input className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
              <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide"><button onClick={() => setSelectedCategory('all')} className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${selectedCategory === 'all' ? 'bg-blue-600 text-white' : 'bg-white border'}`}>Todos</button>{categories.map(cat => (<button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${selectedCategory === cat.id ? 'bg-blue-600 text-white' : 'bg-white border'}`}>{cat.name}</button>))}</div>
              <div className="flex-1 overflow-y-auto pr-2 pb-20 lg:pb-0"><div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">{products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) && (selectedCategory === 'all' || p.categoryId === selectedCategory)).map(product => (<button key={product.id} onClick={() => addToCart(product)} disabled={product.stock <= 0} className={`flex flex-col items-start p-0 rounded-xl border bg-white shadow-sm overflow-hidden ${product.stock > 0 ? 'active:scale-95' : 'opacity-60'}`}><div className="w-full h-32 bg-slate-100 relative">{product.imageUrl ? <img src={product.imageUrl} className="w-full h-full object-cover" onError={(e)=>{e.target.src='https://via.placeholder.com/150'}} /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon className="w-8 h-8"/></div>}<div className="absolute top-1 right-1 bg-white/90 px-1.5 rounded text-[10px] font-bold text-slate-700">{product.stock}</div></div><div className="p-3 w-full text-left"><div className="font-semibold text-slate-800 text-sm truncate">{product.name}</div><div className="font-bold text-blue-600 text-sm">${product.price}</div></div></button>))}</div></div>
            </div>
            <div className={`lg:w-80 bg-white rounded-xl shadow-lg flex flex-col border border-slate-200 ${cart.length === 0 ? 'hidden lg:flex' : 'flex'}`}>
              <div className="p-4 border-b bg-slate-50 rounded-t-xl font-bold text-slate-700 flex gap-2"><ShoppingCart className="w-5 h-5" /> Ticket</div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">{cart.map(item => (<div key={item.id} className="flex items-center gap-3"><div className="flex-1 min-w-0"><div className="font-medium text-sm truncate">{item.name}</div><div className="text-xs text-slate-500">${item.price} x {item.qty}</div></div><div className="flex items-center gap-1"><button onClick={() => updateCartQty(item.id, -1)} className="w-6 h-6 bg-slate-100 rounded flex items-center justify-center"><Minus className="w-3 h-3"/></button><button onClick={() => updateCartQty(item.id, 1)} className="w-6 h-6 bg-slate-100 rounded flex items-center justify-center"><Plus className="w-3 h-3"/></button><button onClick={() => removeFromCart(item.id)} className="ml-1 text-red-400"><Trash2 className="w-4 h-4"/></button></div></div>))}</div>
              <div className="p-4 bg-slate-50 border-t rounded-b-xl space-y-3">
                {userData.role === 'admin' && (<div className="relative">{selectedCustomer ? (<div className="flex items-center justify-between bg-blue-50 p-2 rounded border border-blue-100"><div><div className="text-sm font-bold text-blue-800">{selectedCustomer.name}</div><div className="text-xs text-blue-600">{selectedCustomer.phone}</div></div><button onClick={()=>setSelectedCustomer(null)} className="text-blue-400"><X size={16}/></button></div>) : (<div><div className="flex items-center gap-2 border rounded p-2 bg-white"><Search size={16} className="text-slate-400"/><input className="w-full text-sm outline-none" placeholder="Buscar cliente..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)}/></div>{customerSearch && (<div className="absolute left-0 right-0 top-full mt-1 bg-white border rounded shadow-lg max-h-40 overflow-y-auto z-10">{customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase())).map(c => (<button key={c.id} onClick={()=>{setSelectedCustomer(c); setCustomerSearch('');}} className="w-full text-left p-2 hover:bg-slate-50 text-sm border-b"><div className="font-bold">{c.name}</div><div className="text-xs text-slate-500">{c.phone}</div></button>))}</div>)}</div>)}</div>)}
                <div className="flex justify-between font-bold text-slate-800"><span>Total</span><span>${cartTotal}</span></div>
                <button onClick={handleCheckout} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">Cobrar</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && userData.role === 'admin' && (<div className="h-full flex flex-col pb-20 lg:pb-0"><div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">Inventario</h2><div className="flex gap-2"><button onClick={() => setIsCategoryModalOpen(true)} className="bg-slate-100 text-slate-600 px-3 py-2 rounded-lg flex items-center gap-1 text-sm font-medium"><Tags className="w-4 h-4" /> Cats</button><button onClick={() => handleOpenModal()} className="bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center gap-1 text-sm font-medium"><Plus className="w-4 h-4" /> Prod</button></div></div><div className="flex-1 overflow-y-auto bg-white rounded-xl shadow-sm border"><table className="w-full text-left text-sm"><thead className="bg-slate-50 border-b"><tr><th className="p-3">Prod</th><th className="p-3 text-right">Precio</th><th className="p-3 text-center">Stock</th><th className="p-3 text-right">Acción</th></tr></thead><tbody className="divide-y">{products.map(p => (<tr key={p.id} className="hover:bg-slate-50"><td className="p-3 font-medium">{p.name}</td><td className="p-3 text-right">${p.price}</td><td className="p-3 text-center">{p.stock}</td><td className="p-3 text-right"><button onClick={() => handleOpenModal(p)} className="text-blue-600 mr-2">Edit</button><button onClick={() => handleDeleteProduct(p.id)} className="text-red-500">X</button></td></tr>))}</tbody></table></div></div>)}
        {activeTab === 'customers' && userData.role === 'admin' && (<div className="h-full flex flex-col pb-20 lg:pb-0"><div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">Clientes</h2><button onClick={() => {setEditingCustomer(null); setIsCustomerModalOpen(true);}} className="bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center gap-1 text-sm font-medium"><Plus className="w-4 h-4" /> Cliente</button></div><div className="flex-1 overflow-y-auto bg-white rounded-xl shadow-sm border">{customers.map(c => (<div key={c.id} className="p-4 border-b flex justify-between items-center hover:bg-slate-50"><div><div className="font-bold text-slate-800">{c.name}</div><div className="flex gap-3 text-xs text-slate-500 mt-1"><span className="flex items-center gap-1"><Phone size={12}/> {c.phone}</span><span className="flex items-center gap-1"><MapPin size={12}/> {c.address}</span></div></div><div className="flex gap-2"><button onClick={()=>{setEditingCustomer(c); setIsCustomerModalOpen(true);}} className="text-blue-600 text-xs font-bold border px-2 py-1 rounded">Edit</button><button onClick={()=>handleDeleteCustomer(c.id)} className="text-red-600 text-xs font-bold border px-2 py-1 rounded">Del</button></div></div>))}</div></div>)}
        {activeTab === 'dashboard' && userData.role === 'admin' && (<div className="h-full overflow-y-auto pb-20 lg:pb-0"><h2 className="text-xl font-bold text-slate-800 mb-6">Balance</h2><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="bg-blue-600 rounded-2xl p-6 text-white shadow-lg"><div className="text-3xl font-bold">${stats.totalSales.toLocaleString()}</div><div className="opacity-80 text-sm">Ventas Pagadas</div></div><div className="bg-white rounded-2xl p-6 shadow-sm border"><div className="text-3xl font-bold text-slate-800">${stats.inventoryValue.toLocaleString()}</div><div className="text-slate-500 text-sm">Valor Stock</div></div></div></div>)}
        
        {activeTab === 'transactions' && (
          <div className="h-full flex flex-col pb-20 lg:pb-0">
             <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">Historial</h2>{userData.role === 'admin' && <button onClick={handleExportCSV} className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm flex gap-2"><Download size={16}/> Excel</button>}</div>
             <div className="flex-1 overflow-y-auto bg-white rounded-xl shadow-sm border divide-y">
               {transactions.map(t => (
                 <div key={t.id} className="p-3 flex justify-between items-center hover:bg-slate-50 text-sm">
                   <div>
                     <p className="font-medium">{t.clientName || 'Anónimo'} <span className="text-slate-400 font-normal ml-2">{new Date(t.date?.seconds * 1000).toLocaleTimeString()}</span></p>
                     <div className="flex gap-2 items-center mt-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${!t.paymentStatus || t.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : t.paymentStatus === 'partial' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>{t.paymentStatus === 'partial' ? 'Parcial' : t.paymentStatus === 'pending' ? 'Pendiente' : 'Pagado'}</span>
                        {t.paymentNote && <span className="text-xs text-slate-500 italic"> - {t.paymentNote}</span>}
                     </div>
                     <p className="text-xs text-slate-500 truncate w-48 mt-1">{t.items?.map(i => `${i.qty} ${i.name}`).join(', ')}</p>
                   </div>
                   <div className="flex items-center gap-2">
                     <div className="font-bold text-slate-800">${t.total}</div>
                     {userData.role === 'admin' && (<button onClick={() => {setEditingTransaction(t); setIsTransactionModalOpen(true);}} className="p-2 bg-slate-100 rounded-full hover:bg-blue-100 text-blue-600"><Edit size={14} /></button>)}
                     <button onClick={() => handlePrintTicket(t)} className="p-2 bg-slate-100 rounded-full hover:bg-green-100 text-green-600"><Printer size={14} /></button>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        )}
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 flex justify-around items-center z-[100] shadow-lg">
        <NavButton active={activeTab === 'pos'} onClick={() => setActiveTab('pos')} icon={<LayoutDashboard size={24} />} label="Vender" />
        {userData.role === 'admin' && <NavButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Package size={24} />} label="Stock" />}
        {userData.role === 'admin' && <NavButton active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} icon={<Users size={24} />} label="Clientes" />}
        <NavButton active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} icon={<History size={24} />} label="Historial" />
        {userData.role === 'admin' && <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<TrendingUp size={24} />} label="Balance" />}
      </nav>

      {/* MODAL EDICIÓN BOLETA (MEJORADO CON ITEMS) */}
      {isTransactionModalOpen && userData.role === 'admin' && editingTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[102] backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
                <div className="flex justify-between items-center"><h3 className="font-bold text-lg">Editar Boleta</h3><button onClick={() => setIsTransactionModalOpen(false)}><X size={20}/></button></div>
                
                <form onSubmit={handleUpdateTransaction} className="space-y-4">
                    {/* Sección Items */}
                    <div className="bg-slate-50 p-3 rounded-lg border">
                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Productos</label>
                        {editingTransaction.items.map((item, index) => (
                            <div key={index} className="flex gap-2 mb-2 items-center">
                                <input name={`item_qty_${index}`} defaultValue={item.qty} type="number" className="w-12 p-1 border rounded text-center text-sm" />
                                <input name={`item_name_${index}`} defaultValue={item.name} className="flex-1 p-1 border rounded text-sm" />
                                <span className="text-xs text-slate-400">$</span>
                                <input name={`item_price_${index}`} defaultValue={item.price} type="number" className="w-20 p-1 border rounded text-sm text-right" />
                            </div>
                        ))}
                    </div>

                    {/* Sección Estado */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
                            <select name="paymentStatus" defaultValue={editingTransaction?.paymentStatus || 'paid'} className="w-full p-2 border rounded bg-white text-sm">
                                <option value="paid">✅ Pagado</option>
                                <option value="pending">❌ Pendiente</option>
                                <option value="partial">⚠️ Parcial</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nota</label>
                            <input name="paymentNote" defaultValue={editingTransaction?.paymentNote || ''} className="w-full p-2 border rounded text-sm" />
                        </div>
                    </div>
                    <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700">Guardar Cambios</button>
                </form>
            </div>
        </div>
      )}

      {/* Modales Clásicos... */}
      {isProductModalOpen && userData.role === 'admin' && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[102] backdrop-blur-sm"><div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]"><h3 className="font-bold text-lg">{editingProduct ? 'Editar' : 'Nuevo'} Producto</h3><form onSubmit={handleSaveProduct} className="space-y-3"><input required name="name" defaultValue={editingProduct?.name} className="w-full p-2 border rounded" placeholder="Nombre" /><div className="flex gap-2"><input required name="price" type="number" defaultValue={editingProduct?.price} className="w-1/2 p-2 border rounded" placeholder="Precio" /><input required name="stock" type="number" defaultValue={editingProduct?.stock} className="w-1/2 p-2 border rounded" placeholder="Stock" /></div><select name="category" defaultValue={editingProduct?.categoryId || ""} className="w-full p-2 border rounded bg-white"><option value="">Sin Categoría</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><div className="flex gap-2 bg-slate-100 p-1 rounded"><button type="button" onClick={()=>{setImageMode('file'); setPreviewImage('')}} className={`flex-1 py-1 text-xs rounded ${imageMode==='file'?'bg-white shadow':''}`}>Subir</button><button type="button" onClick={()=>{setImageMode('link'); setPreviewImage('')}} className={`flex-1 py-1 text-xs rounded ${imageMode==='link'?'bg-white shadow':''}`}>Link</button></div>{imageMode === 'file' ? <input type="file" accept="image/*" onChange={handleFileChange} className="text-sm w-full" /> : <input name="imageUrlLink" defaultValue={!editingProduct?.imageUrl?.startsWith('data:')?editingProduct?.imageUrl:''} className="w-full p-2 border rounded text-sm" placeholder="URL imagen..." onChange={(e)=>setPreviewImage(e.target.value)} />}{previewImage && <img src={previewImage} className="h-20 w-full object-cover rounded border" />}<div className="flex gap-2 pt-2"><button type="button" onClick={() => setIsProductModalOpen(false)} className="flex-1 py-2 text-slate-500">Cancelar</button><button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded font-bold">Guardar</button></div></form></div></div>)}
      {isCategoryModalOpen && userData.role === 'admin' && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[102] backdrop-blur-sm"><div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl"><div className="flex justify-between items-center"><h3 className="font-bold text-lg">Categorías</h3><button onClick={()=>setIsCategoryModalOpen(false)}><X size={20}/></button></div><div className="max-h-40 overflow-y-auto space-y-2 border-b pb-4">{categories.map(cat => (<div key={cat.id} className="flex justify-between items-center bg-slate-50 p-2 rounded"><span>{cat.name}</span><button onClick={() => handleDeleteCategory(cat.id)} className="text-red-400"><Trash2 size={16}/></button></div>))}</div><form onSubmit={handleSaveCategory} className="flex gap-2"><input name="catName" required className="flex-1 p-2 border rounded text-sm" placeholder="Nueva..." /><button type="submit" className="bg-green-600 text-white px-4 rounded font-bold">+</button></form></div></div>)}
      {isCustomerModalOpen && userData.role === 'admin' && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[102] backdrop-blur-sm"><div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl"><h3 className="font-bold text-lg">{editingCustomer ? 'Editar' : 'Nuevo'} Cliente</h3><form onSubmit={handleSaveCustomer} className="space-y-3"><input required name="name" defaultValue={editingCustomer?.name} className="w-full p-2 border rounded" placeholder="Nombre Completo" /><input required name="phone" defaultValue={editingCustomer?.phone} className="w-full p-2 border rounded" placeholder="Teléfono" /><input required name="address" defaultValue={editingCustomer?.address} className="w-full p-2 border rounded" placeholder="Dirección" /><input name="email" type="email" defaultValue={editingCustomer?.email} className="w-full p-2 border rounded" placeholder="Email (Opcional)" /><div className="flex gap-2 pt-2"><button type="button" onClick={() => setIsCustomerModalOpen(false)} className="flex-1 py-2 text-slate-500">Cancelar</button><button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded font-bold">Guardar</button></div></form></div></div>)}

      {showCheckoutSuccess && <div className="fixed top-20 right-4 bg-green-600 text-white px-6 py-4 rounded-lg shadow-xl animate-bounce z-[105] flex items-center gap-4"><div><p className="font-bold text-sm">¡Venta Exitosa!</p></div><button onClick={() => {handlePrintTicket(lastTransactionId); setShowCheckoutSuccess(false);}} className="bg-white text-green-600 px-3 py-1 rounded text-xs font-bold hover:bg-green-50">Imprimir Ticket</button></div>}
    </div>
  );
}

function NavButton({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-full h-full ${active ? 'text-blue-600 scale-105' : 'text-slate-400'}`}>
      {icon} <span className="text-[10px] uppercase font-bold mt-1">{label}</span>
    </button>
  );
}
