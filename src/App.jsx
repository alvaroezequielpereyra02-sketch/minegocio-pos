import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc, 
  onSnapshot, 
  serverTimestamp, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  History, 
  Plus, 
  Trash2, 
  Minus, 
  Search, 
  X,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Save,
  Image as ImageIcon,
  Upload,
  Link as LinkIcon,
  Download,
  Tags
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

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('pos');
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estados UI
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(false);
  
  // Estados para imágenes
  const [imageMode, setImageMode] = useState('link'); 
  const [previewImage, setPreviewImage] = useState('');

  // --- Autenticación ---
  useEffect(() => {
    signInAnonymously(auth).catch((error) => console.error(error));
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return () => unsubscribe();
  }, []);

  // --- Sincronización ---
  useEffect(() => {
    if (!user) return;

    // Productos
    const productsRef = collection(db, 'stores', appId, 'products');
    const unsubProducts = onSnapshot(query(productsRef, orderBy('name')), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    // Transacciones
    const transRef = collection(db, 'stores', appId, 'transactions');
    const unsubTrans = onSnapshot(transRef, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      items.sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));
      setTransactions(items);
    });

    // Categorías
    const catRef = collection(db, 'stores', appId, 'categories');
    const unsubCats = onSnapshot(query(catRef, orderBy('name')), (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubProducts(); unsubTrans(); unsubCats(); };
  }, [user]);

  // --- Carrito ---
  const addToCart = (product) => {
    if (product.stock <= 0) return; 
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.qty >= product.stock) return prev; 
        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateCartQty = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.qty + delta;
        const product = products.find(p => p.id === id);
        if (newQty < 1) return item;
        if (product && newQty > product.stock) return item;
        return { ...item, qty: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(item => item.id !== id));
  const cartTotal = useMemo(() => cart.reduce((acc, item) => acc + (item.price * item.qty), 0), [cart]);

  // --- Cálculos de Dashboard ---
  const stats = useMemo(() => {
    let totalSales = 0;
    let totalTrans = 0;
    let inventoryValue = 0;

    transactions.forEach(t => {
      if (t.type === 'sale') {
        totalSales += t.total;
        totalTrans++;
      }
    });

    products.forEach(p => {
      inventoryValue += (p.price * p.stock);
    });

    return { totalSales, totalTrans, inventoryValue };
  }, [transactions, products]);

  // --- Imágenes ---
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.size <= 800000) {
      const reader = new FileReader();
      reader.onloadend = () => setPreviewImage(reader.result);
      reader.readAsDataURL(file);
    } else if(file) {
      alert("Imagen muy pesada (Max 800KB)");
    }
  };

  const handleOpenModal = (product = null) => {
    setEditingProduct(product);
    setPreviewImage(product?.imageUrl || '');
    setImageMode(product?.imageUrl?.startsWith('data:') ? 'file' : 'link'); 
    setIsProductModalOpen(true);
  };

  // --- Exportar CSV ---
  const handleExportCSV = () => {
    if (transactions.length === 0) return alert("No hay datos.");
    const headers = ["Fecha", "Hora", "Tipo", "Total", "Productos"];
    const rows = transactions.map(t => {
      const date = t.date?.seconds ? new Date(t.date.seconds * 1000) : new Date();
      return [
        date.toLocaleDateString(),
        date.toLocaleTimeString(),
        t.type === 'sale' ? 'Venta' : 'Gasto',
        t.total,
        `"${t.items ? t.items.map(i => `${i.qty}x ${i.name}`).join(' | ') : ''}"`
      ];
    });
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.download = `ventas_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // --- Acciones de Datos ---
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!user) return;
    const form = e.target;
    const finalImageUrl = imageMode === 'file' ? previewImage : (form.imageUrlLink?.value || '');
    
    const productData = { 
      name: form.name.value, 
      price: parseFloat(form.price.value), 
      stock: parseInt(form.stock.value),
      categoryId: form.category.value,
      imageUrl: finalImageUrl 
    };

    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'stores', appId, 'products', editingProduct.id), productData);
      } else {
        await addDoc(collection(db, 'stores', appId, 'products'), { ...productData, createdAt: serverTimestamp() });
      }
      setIsProductModalOpen(false);
    } catch (error) { alert("Error al guardar."); }
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    const name = e.target.catName.value;
    if(name) {
      await addDoc(collection(db, 'stores', appId, 'categories'), { name, createdAt: serverTimestamp() });
      setIsCategoryModalOpen(false);
    }
  };

  const handleDeleteCategory = async (id) => {
    if(confirm('¿Borrar categoría?')) await deleteDoc(doc(db, 'stores', appId, 'categories', id));
  };

  const handleDeleteProduct = async (id) => {
    if (confirm('¿Borrar producto?')) await deleteDoc(doc(db, 'stores', appId, 'products', id));
  };

  const handleCheckout = async () => {
    if (!user || cart.length === 0) return;
    await addDoc(collection(db, 'stores', appId, 'transactions'), {
      type: 'sale', total: cartTotal,
      items: cart.map(i => ({ id: i.id, name: i.name, qty: i.qty, price: i.price })),
      sellerId: user.uid, date: serverTimestamp()
    });
    for (const item of cart) {
      const p = products.find(prod => prod.id === item.id);
      if (p) await updateDoc(doc(db, 'stores', appId, 'products', item.id), { stock: Math.max(0, p.stock - item.qty) });
    }
    setCart([]);
    setShowCheckoutSuccess(true);
    setTimeout(() => setShowCheckoutSuccess(false), 3000);
  };

  // --- Renderizadores ---
  
  const renderPOS = () => {
    const filteredProducts = products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
      (selectedCategory === 'all' || p.categoryId === selectedCategory)
    );

    return (
      <div className="flex flex-col h-full lg:flex-row gap-4 overflow-hidden">
        <div className="flex-1 flex flex-col min-h-0">
          {/* Barra de Búsqueda */}
          <div className="mb-3 relative">
            <Search className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
            <input 
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filtros de Categoría */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide">
            <button 
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
            >
              Todos
            </button>
            {categories.map(cat => (
              <button 
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === cat.id ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
              >
                {cat.name}
              </button>
            ))}
          </div>
          
          {/* Grid de Productos */}
          <div className="flex-1 overflow-y-auto pr-2 pb-20 lg:pb-0"> 
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={product.stock <= 0}
                  className={`flex flex-col items-start p-0 rounded-xl border bg-white shadow-sm overflow-hidden ${
                    product.stock > 0 ? 'active:scale-95' : 'opacity-60'
                  }`}
                >
                  <div className="w-full h-32 bg-slate-100 relative">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} className="w-full h-full object-cover" onError={(e)=>{e.target.src='https://via.placeholder.com/150'}} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon className="w-8 h-8"/></div>
                    )}
                    <div className="absolute top-1 right-1 bg-white/90 px-1.5 rounded text-[10px] font-bold text-slate-700">
                      {product.stock}
                    </div>
                  </div>
                  <div className="p-3 w-full text-left">
                    <div className="font-semibold text-slate-800 text-sm truncate">{product.name}</div>
                    <div className="font-bold text-blue-600 text-sm">${product.price}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Carrito */}
        <div className={`lg:w-80 bg-white rounded-xl shadow-lg flex flex-col border border-slate-200 ${cart.length === 0 ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-4 border-b bg-slate-50 rounded-t-xl font-bold text-slate-700 flex gap-2">
            <ShoppingCart className="w-5 h-5" /> Ticket
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.map(item => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{item.name}</div>
                  <div className="text-xs text-slate-500">${item.price} x {item.qty}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateCartQty(item.id, -1)} className="w-6 h-6 bg-slate-100 rounded flex items-center justify-center"><Minus className="w-3 h-3"/></button>
                  <button onClick={() => updateCartQty(item.id, 1)} className="w-6 h-6 bg-slate-100 rounded flex items-center justify-center"><Plus className="w-3 h-3"/></button>
                  <button onClick={() => removeFromCart(item.id)} className="ml-1 text-red-400"><Trash2 className="w-4 h-4"/></button>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 bg-slate-50 border-t rounded-b-xl">
            <div className="flex justify-between mb-4 font-bold text-slate-800">
              <span>Total</span><span>${cartTotal}</span>
            </div>
            <button onClick={handleCheckout} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">Cobrar</button>
          </div>
        </div>
      </div>
    );
  };

  // VISTA INVENTARIO
  const renderInventory = () => (
    <div className="h-full flex flex-col pb-20 lg:pb-0">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-slate-800">Inventario</h2>
        <div className="flex gap-2">
            <button onClick={() => setIsCategoryModalOpen(true)} className="bg-slate-100 text-slate-600 px-3 py-2 rounded-lg flex items-center gap-1 text-sm font-medium hover:bg-slate-200">
                <Tags className="w-4 h-4" /> Categorías
            </button>
            <button onClick={() => handleOpenModal()} className="bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center gap-1 text-sm font-medium hover:bg-blue-700">
                <Plus className="w-4 h-4" /> Producto
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-white rounded-xl shadow-sm border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="p-3">Prod</th>
              <th className="p-3 hidden sm:table-cell">Cat</th>
              <th className="p-3 text-right">Precio</th>
              <th className="p-3 text-center">Stock</th>
              <th className="p-3 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {products.map(p => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="p-3 font-medium">{p.name}</td>
                <td className="p-3 hidden sm:table-cell text-slate-500">
                    {categories.find(c => c.id === p.categoryId)?.name || '-'}
                </td>
                <td className="p-3 text-right">${p.price}</td>
                <td className="p-3 text-center">{p.stock}</td>
                <td className="p-3 text-right">
                  <button onClick={() => handleOpenModal(p)} className="text-blue-600 mr-3">Editar</button>
                  <button onClick={() => handleDeleteProduct(p.id)} className="text-red-500">X</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // VISTA BALANCE (DASHBOARD) - RESTAURADA
  const renderDashboard = () => (
    <div className="h-full overflow-y-auto pb-20 lg:pb-0">
      <h2 className="text-xl font-bold text-slate-800 mb-6">Resumen del Negocio</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-200">
          <div className="flex items-center gap-3 mb-2 opacity-90">
            <DollarSign className="w-5 h-5" />
            <span className="font-medium">Ventas Totales</span>
          </div>
          <div className="text-3xl font-bold">${stats.totalSales.toLocaleString()}</div>
          <div className="mt-4 text-sm opacity-75 bg-blue-700 inline-block px-2 py-1 rounded">
            {stats.totalTrans} transacciones
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-2 text-slate-500">
            <Package className="w-5 h-5" />
            <span className="font-medium">Valor Inventario</span>
          </div>
          <div className="text-3xl font-bold text-slate-800">${stats.inventoryValue.toLocaleString()}</div>
          <div className="mt-4 text-sm text-slate-400">
            En {products.length} productos
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) return <div className="h-screen flex items-center justify-center">Cargando...</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-100 font-sans text-slate-900 overflow-hidden">
      
      {/* HEADER */}
      <header className="bg-white shadow-sm border-b px-4 py-3 flex justify-between items-center z-30 shrink-0 h-16">
        <div className="flex items-center gap-2 font-bold text-xl text-slate-800">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">M</div>
          MiNegocio
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL SCROLLEABLE */}
      <main className="flex-1 overflow-hidden p-4 max-w-5xl mx-auto w-full relative">
        {activeTab === 'pos' && renderPOS()}
        {activeTab === 'inventory' && renderInventory()}
        {activeTab === 'dashboard' && renderDashboard()} {/* Aquí se muestra el Balance */}
        
        {activeTab === 'transactions' && (
          <div className="h-full flex flex-col pb-20 lg:pb-0">
             <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Historial</h2>
                <button onClick={handleExportCSV} className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm flex gap-2"><Download size={16}/> Excel</button>
             </div>
             <div className="flex-1 overflow-y-auto bg-white rounded-xl shadow-sm border divide-y">
               {transactions.map(t => (
                 <div key={t.id} className="p-3 flex justify-between hover:bg-slate-50 text-sm">
                   <div>
                     <p className="font-medium">Venta <span className="text-slate-400 font-normal">{new Date(t.date?.seconds * 1000).toLocaleTimeString()}</span></p>
                     <p className="text-xs text-slate-500 truncate w-48">{t.items?.map(i => `${i.qty} ${i.name}`).join(', ')}</p>
                   </div>
                   <div className="font-bold text-green-600">+${t.total}</div>
                 </div>
               ))}
             </div>
          </div>
        )}
      </main>

      {/* NAVEGACIÓN INFERIOR (MÓVIL) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 flex justify-around items-center z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <NavButton active={activeTab === 'pos'} onClick={() => setActiveTab('pos')} icon={<LayoutDashboard size={24} />} label="Vender" />
        <NavButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Package size={24} />} label="Stock" />
        <NavButton active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} icon={<History size={24} />} label="Historial" />
        <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<TrendingUp size={24} />} label="Balance" />
      </nav>

      {/* NAVEGACIÓN ESCRITORIO */}
      <div className="hidden md:flex fixed bottom-8 left-1/2 -translate-x-1/2 bg-white px-6 py-3 rounded-full shadow-2xl border border-slate-200 gap-8 items-center z-50">
        <NavButton active={activeTab === 'pos'} onClick={() => setActiveTab('pos')} icon={<LayoutDashboard size={20} />} label="Vender" />
        <div className="w-px h-6 bg-slate-200"></div>
        <NavButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Package size={20} />} label="Stock" />
        <div className="w-px h-6 bg-slate-200"></div>
        <NavButton active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} icon={<History size={20} />} label="Historial" />
        <div className="w-px h-6 bg-slate-200"></div>
        <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<TrendingUp size={20} />} label="Balance" />
      </div>

      {/* MODAL PRODUCTO */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="font-bold text-lg">{editingProduct ? 'Editar' : 'Nuevo'} Producto</h3>
            <form onSubmit={handleSaveProduct} className="space-y-3">
              <input required name="name" defaultValue={editingProduct?.name} className="w-full p-2 border rounded" placeholder="Nombre" />
              <div className="flex gap-2">
                <input required name="price" type="number" defaultValue={editingProduct?.price} className="w-1/2 p-2 border rounded" placeholder="Precio" />
                <input required name="stock" type="number" defaultValue={editingProduct?.stock} className="w-1/2 p-2 border rounded" placeholder="Stock" />
              </div>
              
              <select name="category" defaultValue={editingProduct?.categoryId || ""} className="w-full p-2 border rounded bg-white">
                <option value="">Sin Categoría</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              <div className="flex gap-2 bg-slate-100 p-1 rounded">
                 <button type="button" onClick={()=>{setImageMode('file'); setPreviewImage('')}} className={`flex-1 py-1 text-xs rounded ${imageMode==='file'?'bg-white shadow':''}`}>Subir</button>
                 <button type="button" onClick={()=>{setImageMode('link'); setPreviewImage('')}} className={`flex-1 py-1 text-xs rounded ${imageMode==='link'?'bg-white shadow':''}`}>Link</button>
              </div>
              {imageMode === 'file' ? (
                 <input type="file" accept="image/*" onChange={handleFileChange} className="text-sm w-full" />
              ) : (
                 <input name="imageUrlLink" defaultValue={!editingProduct?.imageUrl?.startsWith('data:')?editingProduct?.imageUrl:''} className="w-full p-2 border rounded text-sm" placeholder="URL imagen..." onChange={(e)=>setPreviewImage(e.target.value)} />
              )}
              {previewImage && <img src={previewImage} className="h-20 w-full object-cover rounded border" />}

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsProductModalOpen(false)} className="flex-1 py-2 text-slate-500">Cancelar</button>
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded font-bold">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CATEGORÍAS */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg">Gestionar Categorías</h3>
                <button onClick={()=>setIsCategoryModalOpen(false)}><X size={20}/></button>
            </div>
            
            <div className="max-h-40 overflow-y-auto space-y-2 border-b pb-4">
                {categories.map(cat => (
                    <div key={cat.id} className="flex justify-between items-center bg-slate-50 p-2 rounded">
                        <span>{cat.name}</span>
                        <button onClick={() => handleDeleteCategory(cat.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                    </div>
                ))}
                {categories.length === 0 && <p className="text-sm text-slate-400 text-center">Sin categorías</p>}
            </div>

            <form onSubmit={handleSaveCategory} className="flex gap-2">
                <input name="catName" required className="flex-1 p-2 border rounded text-sm" placeholder="Nueva categoría..." />
                <button type="submit" className="bg-green-600 text-white px-4 rounded font-bold">+</button>
            </form>
          </div>
        </div>
      )}

      {showCheckoutSuccess && <div className="fixed top-20 right-4 bg-green-600 text-white px-6 py-3 rounded shadow-xl animate-bounce z-50">¡Venta Exitosa!</div>}
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
