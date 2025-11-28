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
  Image as ImageIcon // Renombrado para evitar conflicto con etiqueta html
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

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const appId = 'tienda-principal';

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('pos');
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estados UI
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(false);

  // --- Autenticación ---
  useEffect(() => {
    signInAnonymously(auth).catch((error) => {
      console.error("Error auth:", error);
    });
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // --- Sincronización ---
  useEffect(() => {
    if (!user) return;

    const productsRef = collection(db, 'stores', appId, 'products');
    const qProducts = query(productsRef, orderBy('name'));

    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(items);
      setLoading(false);
    }, (error) => console.error("Error productos:", error));

    const transRef = collection(db, 'stores', appId, 'transactions');
    const unsubTrans = onSnapshot(transRef, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      items.sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));
      setTransactions(items);
    }, (error) => console.error("Error transacciones:", error));

    return () => {
      unsubProducts();
      unsubTrans();
    };
  }, [user]);

  // --- Lógica del Carrito ---
  const addToCart = (product) => {
    if (product.stock <= 0) return; 

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.qty >= product.stock) return prev; 
        return prev.map(item => 
          item.id === product.id ? { ...item, qty: item.qty + 1, imageUrl: product.imageUrl } : item
        );
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateCartQty = (productId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        const newQty = item.qty + delta;
        const product = products.find(p => p.id === productId);
        if (newQty < 1) return item;
        if (product && newQty > product.stock) return item;
        return { ...item, qty: newQty };
      }
      return item;
    }));
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  }, [cart]);

  // --- Acciones ---
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!user) return;

    const form = e.target;
    const name = form.name.value;
    const price = parseFloat(form.price.value);
    const stock = parseInt(form.stock.value);
    const imageUrl = form.imageUrl.value; // Nueva línea para imagen
    
    const productData = { name, price, stock, imageUrl }; // Guardamos la URL

    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'stores', appId, 'products', editingProduct.id), productData);
      } else {
        await addDoc(collection(db, 'stores', appId, 'products'), {
          ...productData,
          createdAt: serverTimestamp()
        });
      }
      setIsProductModalOpen(false);
      setEditingProduct(null);
    } catch (error) {
      console.error("Error guardando:", error);
      alert("Error al guardar.");
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!user) return;
    if (confirm('¿Borrar producto?')) {
      await deleteDoc(doc(db, 'stores', appId, 'products', id));
    }
  };

  const handleCheckout = async () => {
    if (!user || cart.length === 0) return;

    try {
      await addDoc(collection(db, 'stores', appId, 'transactions'), {
        type: 'sale',
        total: cartTotal,
        items: cart.map(i => ({ id: i.id, name: i.name, qty: i.qty, price: i.price })),
        sellerId: user.uid,
        date: serverTimestamp()
      });

      for (const item of cart) {
        const currentProduct = products.find(p => p.id === item.id);
        if (currentProduct) {
          const newStock = Math.max(0, currentProduct.stock - item.qty);
          await updateDoc(doc(db, 'stores', appId, 'products', item.id), {
            stock: newStock
          });
        }
      }

      setCart([]);
      setShowCheckoutSuccess(true);
      setTimeout(() => setShowCheckoutSuccess(false), 3000);
    } catch (error) {
      console.error("Error checkout:", error);
    }
  };

  // --- Renderizadores ---
  
  // VISTA POS CON IMÁGENES
  const renderPOS = () => {
    const filteredProducts = products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div className="flex flex-col h-full lg:flex-row gap-4 overflow-hidden">
        <div className="flex-1 flex flex-col min-h-0">
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
            <input 
              type="text"
              placeholder="Buscar productos..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={product.stock <= 0}
                  className={`flex flex-col items-start p-0 rounded-xl border transition-all overflow-hidden bg-white shadow-sm ${
                    product.stock > 0 
                      ? 'hover:border-blue-400 hover:shadow-md active:scale-95' 
                      : 'opacity-60 cursor-not-allowed'
                  }`}
                >
                  {/* Zona de Imagen */}
                  <div className="w-full h-32 bg-slate-100 relative">
                    {product.imageUrl ? (
                      <img 
                        src={product.imageUrl} 
                        alt={product.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {e.target.onerror = null; e.target.src = 'https://via.placeholder.com/150?text=Sin+Imagen'}} // Fallback si falla
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <ImageIcon className="w-10 h-10" />
                      </div>
                    )}
                    {/* Badge de Stock */}
                    <div className={`absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-bold ${
                      product.stock <= 5 ? 'bg-red-500 text-white' : 'bg-white/90 text-slate-700'
                    }`}>
                      {product.stock}
                    </div>
                  </div>

                  {/* Info Producto */}
                  <div className="p-3 w-full text-left">
                    <div className="font-semibold text-slate-800 line-clamp-1 text-sm">{product.name}</div>
                    <div className="mt-1 font-bold text-blue-600">${product.price.toLocaleString()}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Carrito */}
        <div className={`lg:w-80 bg-white rounded-xl shadow-lg flex flex-col border border-slate-200 ${cart.length === 0 && 'hidden lg:flex'}`}>
          <div className="p-4 border-b border-slate-100 bg-slate-50 rounded-t-xl">
            <h2 className="font-bold text-slate-700 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" /> Ticket
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.map(item => (
              <div key={item.id} className="flex items-center gap-3">
                {/* Miniatura en carrito */}
                <div className="w-10 h-10 bg-slate-100 rounded overflow-hidden flex-shrink-0">
                   {item.imageUrl && <img src={item.imageUrl} className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800 text-sm truncate">{item.name}</div>
                  <div className="text-xs text-slate-500">${item.price} x {item.qty}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateCartQty(item.id, -1)} className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center hover:bg-slate-200"><Minus className="w-3 h-3"/></button>
                  <button onClick={() => updateCartQty(item.id, 1)} className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center hover:bg-slate-200"><Plus className="w-3 h-3"/></button>
                  <button onClick={() => removeFromCart(item.id)} className="ml-1 text-red-400"><Trash2 className="w-4 h-4"/></button>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 rounded-b-xl">
            <div className="flex justify-between items-center mb-4">
              <span className="text-slate-600 font-medium">Total</span>
              <span className="text-2xl font-bold text-slate-800">${cartTotal.toLocaleString()}</span>
            </div>
            <button 
              onClick={handleCheckout}
              disabled={cart.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold shadow-sm active:scale-95 transition-all"
            >
              Cobrar
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderInventory = () => (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Inventario</h2>
        <button 
          onClick={() => { setEditingProduct(null); setIsProductModalOpen(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Agregar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-white rounded-xl shadow-sm border border-slate-200">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-4 w-16">Img</th>
              <th className="p-4 font-semibold text-slate-600">Producto</th>
              <th className="p-4 font-semibold text-slate-600 text-right">Precio</th>
              <th className="p-4 font-semibold text-slate-600 text-center">Stock</th>
              <th className="p-4 font-semibold text-slate-600 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map(p => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="p-4">
                  <div className="w-10 h-10 bg-slate-100 rounded overflow-hidden">
                    {p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-cover"/> : <div className="flex items-center justify-center h-full"><ImageIcon className="w-4 h-4 text-slate-300"/></div>}
                  </div>
                </td>
                <td className="p-4 text-slate-800 font-medium">{p.name}</td>
                <td className="p-4 text-right text-slate-600">${p.price}</td>
                <td className="p-4 text-center">{p.stock}</td>
                <td className="p-4 text-right">
                  <button onClick={() => { setEditingProduct(p); setIsProductModalOpen(true); }} className="text-blue-500 hover:text-blue-700 mr-3 font-medium text-sm">Editar</button>
                  <button onClick={() => handleDeleteProduct(p.id)} className="text-red-400 hover:text-red-600 font-medium text-sm">Borrar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // --- Render Principal ---
  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50">Cargando...</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-100 font-sans text-slate-900">
      
      {/* Navbar */}
      <header className="bg-white shadow-sm border-b border-slate-200 px-4 py-3 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">M</div>
          <h1 className="font-bold text-xl tracking-tight text-slate-800">MiNegocio <span className="text-blue-600">POS</span></h1>
        </div>
        <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
        </div>
      </header>

      {/* Contenido */}
      <main className="flex-1 overflow-hidden p-4 pb-24 md:pb-4 max-w-5xl mx-auto w-full">
        {activeTab === 'pos' && renderPOS()}
        {activeTab === 'inventory' && renderInventory()}
        {activeTab === 'transactions' && (
          <div className="h-full overflow-y-auto">
             <h2 className="text-2xl font-bold mb-4">Historial</h2>
             {transactions.map(t => (
               <div key={t.id} className="bg-white p-4 mb-2 rounded shadow-sm flex justify-between">
                 <div>
                   <div className="font-bold">Venta</div>
                   <div className="text-xs text-slate-500">{new Date(t.date?.seconds * 1000).toLocaleString()}</div>
                 </div>
                 <div className="text-green-600 font-bold">+${t.total}</div>
               </div>
             ))}
          </div>
        )}
        {activeTab === 'dashboard' && <div className="p-4 bg-white rounded shadow">Próximamente: Estadísticas avanzadas</div>}
      </main>

      {/* Menú Móvil */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 pb-safe flex justify-around items-center h-16 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
        <NavButton active={activeTab === 'pos'} onClick={() => setActiveTab('pos')} icon={<LayoutDashboard size={20} />} label="Vender" />
        <NavButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Package size={20} />} label="Stock" />
        <NavButton active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} icon={<History size={20} />} label="Historial" />
        <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<TrendingUp size={20} />} label="Balance" />
      </nav>

      {/* Menú Desktop */}
      <div className="hidden md:flex fixed bottom-8 left-1/2 -translate-x-1/2 bg-white px-6 py-3 rounded-full shadow-xl border border-slate-200 gap-8 items-center z-20">
        <NavButton active={activeTab === 'pos'} onClick={() => setActiveTab('pos')} icon={<LayoutDashboard size={20} />} label="Vender" />
        <NavButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Package size={20} />} label="Stock" />
        <NavButton active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} icon={<History size={20} />} label="Historial" />
        <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<TrendingUp size={20} />} label="Balance" />
      </div>

      {/* Modal Producto */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h3>
              <button onClick={() => setIsProductModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Nombre</label>
                <input required name="name" defaultValue={editingProduct?.name} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Precio ($)</label>
                  <input required name="price" type="number" step="0.01" defaultValue={editingProduct?.price} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Stock</label>
                  <input required name="stock" type="number" defaultValue={editingProduct?.stock} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" />
                </div>
              </div>
              
              {/* CAMPO DE IMAGEN NUEVO */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Link de Imagen (Opcional)</label>
                <div className="flex gap-2">
                    <input 
                        name="imageUrl" 
                        defaultValue={editingProduct?.imageUrl} 
                        className="flex-1 px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm" 
                        placeholder="https://..." 
                    />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Tip: Copia el enlace de una imagen de Google y pégalo aquí.</p>
              </div>

              <div className="pt-2">
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
                  <Save className="w-5 h-5" /> Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Éxito */}
      {showCheckoutSuccess && (
        <div className="fixed top-20 right-4 md:right-8 bg-green-600 text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-3 animate-in slide-in-from-top duration-300 z-50">
          <div className="bg-white/20 p-1 rounded-full"><TrendingUp className="w-4 h-4" /></div>
          <div>
            <p className="font-bold text-sm">¡Venta Registrada!</p>
          </div>
        </div>
      )}

    </div>
  );
}

function NavButton({ active, onClick, icon, label }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 p-2 transition-all ${
        active ? 'text-blue-600 scale-105 font-medium' : 'text-slate-400 hover:text-slate-600'
      }`}
    >
      {icon}
      <span className="text-[10px] uppercase tracking-wide">{label}</span>
    </button>
  );
}
