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
  Link as LinkIcon, Download, Tags, LogOut, Users, MapPin, Phone, UserCheck
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
  
  // Estados de la App
  const [activeTab, setActiveTab] = useState('pos');
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]); // NUEVO: Base de clientes
  const [cart, setCart] = useState([]);
  
  // UI States
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false); // Modal Clientes
  
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null); // Editar Cliente
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(false);
  const [imageMode, setImageMode] = useState('link'); 
  const [previewImage, setPreviewImage] = useState('');
  
  // Estados para Venta
  const [selectedCustomer, setSelectedCustomer] = useState(null); // Cliente seleccionado en caja
  const [customerSearch, setCustomerSearch] = useState(''); // Buscador de clientes en caja

  // Estados de Login
  const [isRegistering, setIsRegistering] = useState(false);
  const [loginError, setLoginError] = useState('');

  // --- AUTENTICACIÓN ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) setUserData(userDoc.data());
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

    // Productos
    const unsubProducts = onSnapshot(query(collection(db, 'stores', appId, 'products'), orderBy('name')), (snap) => {
      setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Categorías
    const unsubCats = onSnapshot(query(collection(db, 'stores', appId, 'categories'), orderBy('name')), (snap) => {
      setCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Clientes (NUEVO)
    const unsubCustomers = onSnapshot(query(collection(db, 'stores', appId, 'customers'), orderBy('name')), (snap) => {
      setCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Transacciones
    const transRef = collection(db, 'stores', appId, 'transactions');
    const unsubTrans = onSnapshot(collection(db, 'stores', appId, 'transactions'), (snapshot) => {
      let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (userData.role !== 'admin') items = items.filter(t => t.clientId === user.uid);
      items.sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));
      setTransactions(items);
    });

    return () => { unsubProducts(); unsubTrans(); unsubCats(); unsubCustomers(); };
  }, [user, userData]);

  // --- LOGIN / REGISTER ---
  const handleLogin = async (e) => {
    e.preventDefault(); setLoginError('');
    try { await signInWithEmailAndPassword(auth, e.target.email.value, e.target.password.value); } 
    catch (error) { setLoginError("Credenciales incorrectas."); }
  };

  const handleRegister = async (e) => {
    e.preventDefault(); setLoginError('');
    const form = e.target;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, form.email.value, form.password.value);
      const role = (form.secretCode?.value === ADMIN_SECRET_CODE) ? 'admin' : 'client';
      const newUserData = {
        email: form.email.value,
        name: form.name.value,
        phone: form.phone.value,
        address: form.address.value,
        role,
        createdAt: serverTimestamp()
      };
      
      // Guardar en 'users' para auth
      await setDoc(doc(db, 'users', userCredential.user.uid), newUserData);
      
      // Si es cliente, guardarlo TAMBIÉN en la base de clientes del negocio automáticamente
      if(role === 'client') {
         await addDoc(collection(db, 'stores', appId, 'customers'), {
            name: form.name.value,
            phone: form.phone.value,
            address: form.address.value,
            email: form.email.value,
            createdAt: serverTimestamp()
         });
      }

    } catch (error) { setLoginError(error.message); }
  };

  const handleLogout = () => { signOut(auth); setCart([]); setUserData(null); };

  // --- POS ---
  const addToCart = (product) => {
    if (product.stock <= 0) return; 
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      return existing 
        ? prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item)
        : [...prev, { ...product, qty: 1, imageUrl: product.imageUrl }];
    });
  };

  const updateCartQty = (id, delta) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, qty: item.qty + delta } : item).filter(i => i.qty > 0 || i.id !== id)); // Auto remove if 0
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(item => item.id !== id));
  const cartTotal = useMemo(() => cart.reduce((acc, item) => acc + (item.price * item.qty), 0), [cart]);

  // --- CHECKOUT ---
  const handleCheckout = async () => {
    if (!user || cart.length === 0) return;

    // Determinar cliente
    let finalClient = { id: 'anonimo', name: 'Anónimo', role: 'guest' };
    
    if (userData.role === 'admin') {
        if (selectedCustomer) {
            finalClient = { id: selectedCustomer.id, name: selectedCustomer.name, role: 'customer' };
        }
    } else {
        // Si es cliente comprando él mismo
        finalClient = { id: user.uid, name: userData.name, role: 'client' };
    }

    const saleData = {
      type: 'sale', total: cartTotal,
      items: cart.map(i => ({ id: i.id, name: i.name, qty: i.qty, price: i.price })),
      date: serverTimestamp(),
      clientId: finalClient.id,
      clientName: finalClient.name,
      clientRole: finalClient.role,
      sellerId: user.uid
    };

    try {
      await addDoc(collection(db, 'stores', appId, 'transactions'), saleData);
      for (const item of cart) {
        const p = products.find(prod => prod.id === item.id);
        if (p) await updateDoc(doc(db, 'stores', appId, 'products', item.id), { stock: Math.max(0, p.stock - item.qty) });
      }
      setCart([]); setSelectedCustomer(null); setCustomerSearch('');
      setShowCheckoutSuccess(true); setTimeout(() => setShowCheckoutSuccess(false), 3000);
    } catch (error) { alert("Error venta."); }
  };

  // --- GESTIÓN DE CLIENTES ---
  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    const form = e.target;
    const customerData = {
        name: form.name.value,
        phone: form.phone.value,
        address: form.address.value,
        email: form.email.value
    };

    try {
        if(editingCustomer) {
            await updateDoc(doc(db, 'stores', appId, 'customers', editingCustomer.id), customerData);
        } else {
            await addDoc(collection(db, 'stores', appId, 'customers'), { ...customerData, createdAt: serverTimestamp() });
        }
        setIsCustomerModalOpen(false);
    } catch (error) { alert("Error guardando cliente"); }
  };

  const handleDeleteCustomer = async (id) => {
      if(confirm('¿Borrar cliente?')) await deleteDoc(doc(db, 'stores', appId, 'customers', id));
  };

  // --- IMÁGENES / EXPORTAR / PRODUCTOS (Funciones anteriores) ---
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.size <= 800000) {
      const reader = new FileReader();
      reader.onloadend = () => setPreviewImage(reader.result);
      reader.readAsDataURL(file);
    }
  };
  const handleExportCSV = () => {
    if (transactions.length === 0) return alert("No hay datos.");
    const headers = ["Fecha", "Hora", "Cliente", "Total", "Productos"];
    const rows = transactions.map(t => {
      const date = t.date?.seconds ? new Date(t.date.seconds * 1000) : new Date();
      return [ date.toLocaleDateString(), date.toLocaleTimeString(), t.clientName || 'Anónimo', t.total, `"${t.items ? t.items.map(i => `${i.qty}x ${i.name}`).join(' | ') : ''}"` ];
    });
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.download = `ventas_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const form = e.target;
    const finalImageUrl = imageMode === 'file' ? previewImage : (form.imageUrlLink?.value || '');
    const productData = { name: form.name.value, price: parseFloat(form.price.value), stock: parseInt(form.stock.value), categoryId: form.category.value, imageUrl: finalImageUrl };
    if (editingProduct) await updateDoc(doc(db, 'stores', appId, 'products', editingProduct.id), productData);
    else await addDoc(collection(db, 'stores', appId, 'products'), { ...productData, createdAt: serverTimestamp() });
    setIsProductModalOpen(false);
  };
  const handleSaveCategory = async (e) => {
    const name = e.target.catName.value;
    if(name) { await addDoc(collection(db, 'stores', appId, 'categories'), { name, createdAt: serverTimestamp() }); setIsCategoryModalOpen(false); }
  };
  const handleDeleteProduct = async (id) => { if (confirm('¿Borrar?')) await deleteDoc(doc(db, 'stores', appId, 'products', id)); };
  const handleDeleteCategory = async (id) => { if(confirm('¿Borrar?')) await deleteDoc(doc(db, 'stores', appId, 'categories', id)); };
  
  // Stats
  const stats = useMemo(() => {
    let totalSales = 0, totalTrans = 0, inventoryValue = 0;
    transactions.forEach(t => { if (t.type === 'sale') { totalSales += t.total; totalTrans++; } });
    products.forEach(p => { inventoryValue += (p.price * p.stock); });
    return { totalSales, totalTrans, inventoryValue };
  }, [transactions, products]);


  // --- VISTAS ---

  if (authLoading) return <div className="h-screen flex items-center justify-center bg-slate-50 text-blue-600 animate-pulse font-bold">Cargando...</div>;

  if (!user || !userData) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-2">M</div>
            <h1 className="text-2xl font-bold text-slate-800">{isRegistering ? 'Crear Cuenta' : 'Acceso'}</h1>
          </div>
          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
            {isRegistering && (
              <>
                <input name="name" required className="w-full p-3 border rounded-lg bg-slate-50" placeholder="Nombre Completo" />
                <div className="grid grid-cols-2 gap-2">
                  <input name="phone" required className="w-full p-3 border rounded-lg bg-slate-50" placeholder="Teléfono" />
                  <input name="address" required className="w-full p-3 border rounded-lg bg-slate-50" placeholder="Dirección" />
                </div>
                <div className="pt-2 border-t mt-2"><p className="text-xs text-slate-400 mb-1">Personal (Opcional):</p><input name="secretCode" className="w-full p-2 border rounded-lg text-sm" placeholder="Código Admin" /></div>
              </>
            )}
            <input name="email" type="email" required className="w-full p-3 border rounded-lg bg-slate-50" placeholder="Correo" />
            <input name="password" type="password" required className="w-full p-3 border rounded-lg bg-slate-50" placeholder="Contraseña" />
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
      <header className="bg-white shadow-sm border-b px-4 py-3 flex justify-between items-center z-30 shrink-0 h-16">
        <div className="flex items-center gap-2 font-bold text-xl text-slate-800"><div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">M</div>MiNegocio</div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block"><div className="text-sm font-bold">{userData.name}</div><div className="text-xs text-slate-500 capitalize">{userData.role === 'admin' ? 'Admin' : 'Cliente'}</div></div>
          <button onClick={handleLogout} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><LogOut size={18}/></button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden p-4 max-w-5xl mx-auto w-full relative">
        {activeTab === 'pos' && (
          <div className="flex flex-col h-full lg:flex-row gap-4 overflow-hidden">
            <div className="flex-1 flex flex-col min-h-0">
              <div className="mb-3 relative"><Search className="absolute left-3 top-3 text-slate-400 w-5 h-5" /><input className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
              <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide">
                <button onClick={() => setSelectedCategory('all')} className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${selectedCategory === 'all' ? 'bg-blue-600 text-white' : 'bg-white border'}`}>Todos</button>
                {categories.map(cat => (<button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${selectedCategory === cat.id ? 'bg-blue-600 text-white' : 'bg-white border'}`}>{cat.name}</button>))}
              </div>
              <div className="flex-1 overflow-y-auto pr-2 pb-20 lg:pb-0">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) && (selectedCategory === 'all' || p.categoryId === selectedCategory)).map(product => (
                    <button key={product.id} onClick={() => addToCart(product)} disabled={product.stock <= 0} className={`flex flex-col items-start p-0 rounded-xl border bg-white shadow-sm overflow-hidden ${product.stock > 0 ? 'active:scale-95' : 'opacity-60'}`}>
                      <div className="w-full h-32 bg-slate-100 relative">
                        {product.imageUrl ? <img src={product.imageUrl} className="w-full h-full object-cover" onError={(e)=>{e.target.src='https://via.placeholder.com/150'}} /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon className="w-8 h-8"/></div>}
                        <div className="absolute top-1 right-1 bg-white/90 px-1.5 rounded text-[10px] font-bold text-slate-700">{product.stock}</div>
                      </div>
                      <div className="p-3 w-full text-left"><div className="font-semibold text-slate-800 text-sm truncate">{product.name}</div><div className="font-bold text-blue-600 text-sm">${product.price}</div></div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            {/* TICKET CON BUSCADOR DE CLIENTES */}
            <div className={`lg:w-80 bg-white rounded-xl shadow-lg flex flex-col border border-slate-200 ${cart.length === 0 ? 'hidden lg:flex' : 'flex'}`}>
              <div className="p-4 border-b bg-slate-50 rounded-t-xl font-bold text-slate-700 flex gap-2"><ShoppingCart className="w-5 h-5" /> Ticket</div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0"><div className="font-medium text-sm truncate">{item.name}</div><div className="text-xs text-slate-500">${item.price} x {item.qty}</div></div>
                    <div className="flex items-center gap-1"><button onClick={() => updateCartQty(item.id, -1)} className="w-6 h-6 bg-slate-100 rounded flex items-center justify-center"><Minus className="w-3 h-3"/></button><button onClick={() => updateCartQty(item.id, 1)} className="w-6 h-6 bg-slate-100 rounded flex items-center justify-center"><Plus className="w-3 h-3"/></button><button onClick={() => removeFromCart(item.id)} className="ml-1 text-red-400"><Trash2 className="w-4 h-4"/></button></div>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-slate-50 border-t rounded-b-xl space-y-3">
                {userData.role === 'admin' && (
                    <div className="relative">
                        {selectedCustomer ? (
                            <div className="flex items-center justify-between bg-blue-50 p-2 rounded border border-blue-100">
                                <div>
                                    <div className="text-sm font-bold text-blue-800">{selectedCustomer.name}</div>
                                    <div className="text-xs text-blue-600">{selectedCustomer.phone}</div>
                                </div>
                                <button onClick={()=>setSelectedCustomer(null)} className="text-blue-400 hover:text-blue-700"><X size={16}/></button>
                            </div>
                        ) : (
                            <div>
                                <div className="flex items-center gap-2 border rounded p-2 bg-white">
                                    <Search size={16} className="text-slate-400"/>
                                    <input 
                                        className="w-full text-sm outline-none" 
                                        placeholder="Buscar cliente..." 
                                        value={customerSearch}
                                        onChange={(e) => setCustomerSearch(e.target.value)}
                                    />
                                </div>
                                {customerSearch && (
                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border rounded shadow-lg max-h-40 overflow-y-auto z-10">
                                        {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase())).map(c => (
                                            <button key={c.id} onClick={()=>{setSelectedCustomer(c); setCustomerSearch('');}} className="w-full text-left p-2 hover:bg-slate-50 text-sm border-b">
                                                <div className="font-bold">{c.name}</div>
                                                <div className="text-xs text-slate-500">{c.phone}</div>
                                            </button>
                                        ))}
                                        {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase())).length === 0 && (
                                            <div className="p-2 text-xs text-slate-400 text-center">No encontrado. <br/> Ve a Clientes para crearlo.</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
                <div className="flex justify-between font-bold text-slate-800"><span>Total</span><span>${cartTotal}</span></div>
                <button onClick={handleCheckout} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">{userData.role === 'admin' ? 'Cobrar' : 'Realizar Pedido'}</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && userData.role === 'admin' && (
          <div className="h-full flex flex-col pb-20 lg:pb-0">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Inventario</h2>
              <div className="flex gap-2"><button onClick={() => setIsCategoryModalOpen(true)} className="bg-slate-100 text-slate-600 px-3 py-2 rounded-lg flex items-center gap-1 text-sm font-medium"><Tags className="w-4 h-4" /> Cats</button><button onClick={() => handleOpenModal()} className="bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center gap-1 text-sm font-medium"><Plus className="w-4 h-4" /> Prod</button></div>
            </div>
            <div className="flex-1 overflow-y-auto bg-white rounded-xl shadow-sm border"><table className="w-full text-left text-sm"><thead className="bg-slate-50 border-b"><tr><th className="p-3">Prod</th><th className="p-3 text-right">Precio</th><th className="p-3 text-center">Stock</th><th className="p-3 text-right">Acción</th></tr></thead><tbody className="divide-y">{products.map(p => (<tr key={p.id} className="hover:bg-slate-50"><td className="p-3 font-medium">{p.name}</td><td className="p-3 text-right">${p.price}</td><td className="p-3 text-center">{p.stock}</td><td className="p-3 text-right"><button onClick={() => handleOpenModal(p)} className="text-blue-600 mr-2">Edit</button><button onClick={() => handleDeleteProduct(p.id)} className="text-red-500">X</button></td></tr>))}</tbody></table></div>
          </div>
        )}

        {/* PESTAÑA CLIENTES (NUEVA) */}
        {activeTab === 'customers' && userData.role === 'admin' && (
            <div className="h-full flex flex-col pb-20 lg:pb-0">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Base de Clientes</h2>
                    <button onClick={() => {setEditingCustomer(null); setIsCustomerModalOpen(true);}} className="bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center gap-1 text-sm font-medium"><Plus className="w-4 h-4" /> Cliente</button>
                </div>
                <div className="flex-1 overflow-y-auto bg-white rounded-xl shadow-sm border">
                    {customers.map(c => (
                        <div key={c.id} className="p-4 border-b flex justify-between items-center hover:bg-slate-50">
                            <div>
                                <div className="font-bold text-slate-800">{c.name}</div>
                                <div className="flex gap-3 text-xs text-slate-500 mt-1">
                                    <span className="flex items-center gap-1"><Phone size={12}/> {c.phone}</span>
                                    <span className="flex items-center gap-1"><MapPin size={12}/> {c.address}</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={()=>{setEditingCustomer(c); setIsCustomerModalOpen(true);}} className="text-blue-600 text-xs font-bold border px-2 py-1 rounded">Editar</button>
                                <button onClick={()=>handleDeleteCustomer(c.id)} className="text-red-600 text-xs font-bold border px-2 py-1 rounded">Borrar</button>
                            </div>
                        </div>
                    ))}
                    {customers.length === 0 && <div className="p-8 text-center text-slate-400">No hay clientes registrados</div>}
                </div>
            </div>
        )}

        {activeTab === 'transactions' && (
          <div className="h-full flex flex-col pb-20 lg:pb-0">
             <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">Historial</h2>{userData.role === 'admin' && <button onClick={handleExportCSV} className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm flex gap-2"><Download size={16}/> Excel</button>}</div>
             <div className="flex-1 overflow-y-auto bg-white rounded-xl shadow-sm border divide-y">{transactions.map(t => (<div key={t.id} className="p-3 flex justify-between hover:bg-slate-50 text-sm"><div><p className="font-medium">{userData.role === 'admin' ? (t.clientName || 'Anónimo') : 'Compra'} <span className="text-slate-400 font-normal ml-2">{new Date(t.date?.seconds * 1000).toLocaleTimeString()}</span></p><p className="text-xs text-slate-500 truncate w-48">{t.items?.map(i => `${i.qty} ${i.name}`).join(', ')}</p></div><div className="font-bold text-green-600">+${t.total}</div></div>))}</div>
          </div>
        )}

        {activeTab === 'dashboard' && userData.role === 'admin' && (
          <div className="h-full overflow-y-auto pb-20 lg:pb-0">
            <h2 className="text-xl font-bold text-slate-800 mb-6">Balance</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="bg-blue-600 rounded-2xl p-6 text-white shadow-lg"><div className="text-3xl font-bold">${stats.totalSales.toLocaleString()}</div><div className="opacity-80 text-sm">Ventas Totales</div></div><div className="bg-white rounded-2xl p-6 shadow-sm border"><div className="text-3xl font-bold text-slate-800">${stats.inventoryValue.toLocaleString()}</div><div className="text-slate-500 text-sm">Valor Stock</div></div></div>
          </div>
        )}
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 flex justify-around items-center z-50 shadow-lg">
        <NavButton active={activeTab === 'pos'} onClick={() => setActiveTab('pos')} icon={<LayoutDashboard size={20} />} label="Vender" />
        {userData.role === 'admin' && <NavButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Package size={20} />} label="Stock" />}
        {userData.role === 'admin' && <NavButton active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} icon={<Users size={20} />} label="Clientes" />}
        <NavButton active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} icon={<History size={20} />} label="Historial" />
        {userData.role === 'admin' && <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<TrendingUp size={20} />} label="Balance" />}
      </nav>

      <div className="hidden md:flex fixed bottom-8 left-1/2 -translate-x-1/2 bg-white px-6 py-3 rounded-full shadow-2xl border border-slate-200 gap-8 items-center z-50">
        <NavButton active={activeTab === 'pos'} onClick={() => setActiveTab('pos')} icon={<LayoutDashboard size={20} />} label="Vender" />
        {userData.role === 'admin' && <><div className="w-px h-6 bg-slate-200"></div><NavButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Package size={20} />} label="Stock" /><div className="w-px h-6 bg-slate-200"></div><NavButton active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} icon={<Users size={20} />} label="Clientes" /></>}
        <div className="w-px h-6 bg-slate-200"></div><NavButton active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} icon={<History size={20} />} label="Historial" />
        {userData.role === 'admin' && <><div className="w-px h-6 bg-slate-200"></div><NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<TrendingUp size={20} />} label="Balance" /></>}
      </div>

      {/* MODALES PRODUCTO Y CATEGORIA (Iguales) */}
      {isProductModalOpen && userData.role === 'admin' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm"><div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]"><h3 className="font-bold text-lg">{editingProduct ? 'Editar' : 'Nuevo'} Producto</h3><form onSubmit={handleSaveProduct} className="space-y-3"><input required name="name" defaultValue={editingProduct?.name} className="w-full p-2 border rounded" placeholder="Nombre" /><div className="flex gap-2"><input required name="price" type="number" defaultValue={editingProduct?.price} className="w-1/2 p-2 border rounded" placeholder="Precio" /><input required name="stock" type="number" defaultValue={editingProduct?.stock} className="w-1/2 p-2 border rounded" placeholder="Stock" /></div><select name="category" defaultValue={editingProduct?.categoryId || ""} className="w-full p-2 border rounded bg-white"><option value="">Sin Categoría</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><div className="flex gap-2 bg-slate-100 p-1 rounded"><button type="button" onClick={()=>{setImageMode('file'); setPreviewImage('')}} className={`flex-1 py-1 text-xs rounded ${imageMode==='file'?'bg-white shadow':''}`}>Subir</button><button type="button" onClick={()=>{setImageMode('link'); setPreviewImage('')}} className={`flex-1 py-1 text-xs rounded ${imageMode==='link'?'bg-white shadow':''}`}>Link</button></div>{imageMode === 'file' ? <input type="file" accept="image/*" onChange={handleFileChange} className="text-sm w-full" /> : <input name="imageUrlLink" defaultValue={!editingProduct?.imageUrl?.startsWith('data:')?editingProduct?.imageUrl:''} className="w-full p-2 border rounded text-sm" placeholder="URL imagen..." onChange={(e)=>setPreviewImage(e.target.value)} />}{previewImage && <img src={previewImage} className="h-20 w-full object-cover rounded border" />}<div className="flex gap-2 pt-2"><button type="button" onClick={() => setIsProductModalOpen(false)} className="flex-1 py-2 text-slate-500">Cancelar</button><button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded font-bold">Guardar</button></div></form></div></div>
      )}
      {isCategoryModalOpen && userData.role === 'admin' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm"><div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl"><div className="flex justify-between items-center"><h3 className="font-bold text-lg">Categorías</h3><button onClick={()=>setIsCategoryModalOpen(false)}><X size={20}/></button></div><div className="max-h-40 overflow-y-auto space-y-2 border-b pb-4">{categories.map(cat => (<div key={cat.id} className="flex justify-between items-center bg-slate-50 p-2 rounded"><span>{cat.name}</span><button onClick={() => handleDeleteCategory(cat.id)} className="text-red-400"><Trash2 size={16}/></button></div>))}</div><form onSubmit={handleSaveCategory} className="flex gap-2"><input name="catName" required className="flex-1 p-2 border rounded text-sm" placeholder="Nueva..." /><button type="submit" className="bg-green-600 text-white px-4 rounded font-bold">+</button></form></div></div>
      )}

      {/* MODAL CLIENTE (NUEVO) */}
      {isCustomerModalOpen && userData.role === 'admin' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
                <h3 className="font-bold text-lg">{editingCustomer ? 'Editar' : 'Nuevo'} Cliente</h3>
                <form onSubmit={handleSaveCustomer} className="space-y-3">
                    <input required name="name" defaultValue={editingCustomer?.name} className="w-full p-2 border rounded" placeholder="Nombre Completo" />
                    <input required name="phone" defaultValue={editingCustomer?.phone} className="w-full p-2 border rounded" placeholder="Teléfono" />
                    <input required name="address" defaultValue={editingCustomer?.address} className="w-full p-2 border rounded" placeholder="Dirección" />
                    <input name="email" type="email" defaultValue={editingCustomer?.email} className="w-full p-2 border rounded" placeholder="Email (Opcional)" />
                    <div className="flex gap-2 pt-2">
                        <button type="button" onClick={() => setIsCustomerModalOpen(false)} className="flex-1 py-2 text-slate-500">Cancelar</button>
                        <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded font-bold">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {showCheckoutSuccess && <div className="fixed top-20 right-4 bg-green-600 text-white px-6 py-3 rounded shadow-xl animate-bounce z-50">¡Éxito!</div>}
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
