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
  AlertTriangle
} from 'lucide-react';

// --- CONFIGURACIÓN DE FIREBASE ---
// IMPORTANTE: Para usar esto en Vercel/Android, debes crear un proyecto en 
// console.firebase.google.com y reemplazar estos valores con los tuyos.
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "TU_API_KEY_AQUI",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ID DE LA TIENDA COMPARTIDA
// Usamos un ID fijo para que todos los vendedores vean EL MISMO inventario.
const STORE_ID = 'tienda_principal'; 

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('pos');
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState(false);
  
  // Estados UI
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(false);

  // --- Autenticación ---
  useEffect(() => {
    // Intentamos iniciar sesión anónima
    signInAnonymously(auth).catch((error) => {
      console.error("Error auth:", error);
      // Si falla por configuración inválida (API Key de ejemplo)
      if (error.code === 'auth/invalid-api-key' || error.code === 'auth/internal-error') {
        setConfigError(true);
        setLoading(false);
      }
    });
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setConfigError(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // --- Sincronización en Tiempo Real (Internet) ---
  useEffect(() => {
    if (!user || configError) return;

    // Escuchar Productos (Compartidos)
    // Ruta: stores/tienda_principal/products
    const productsRef = collection(db, 'stores', STORE_ID, 'products');
    const qProducts = query(productsRef, orderBy('name'));

    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(items);
      setLoading(false);
    }, (error) => {
        console.error("Error leyendo productos:", error);
        if(error.code === 'permission-denied') alert("Falta configurar reglas de Firestore");
    });

    // Escuchar Transacciones (Compartidas)
    // Ruta: stores/tienda_principal/transactions
    // Nota: Usamos query simple para evitar errores de índice en la demo
    const transRef = collection(db, 'stores', STORE_ID, 'transactions');
    const unsubTrans = onSnapshot(transRef, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Ordenar en cliente por fecha
      items.sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));
      setTransactions(items);
    }, (error) => console.error("Error transacciones:", error));

    return () => {
      unsubProducts();
      unsubTrans();
    };
  }, [user, configError]);

  // --- Lógica del Carrito ---
  const addToCart = (product) => {
    if (product.stock <= 0) return; 

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.qty >= product.stock) return prev; 
        return prev.map(item => 
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
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

  // --- Acciones en la Nube ---
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!user) return;

    const form = e.target;
    const name = form.name.value;
    const price = parseFloat(form.price.value);
    const stock = parseInt(form.stock.value);
    
    const productData = { name, price, stock };

    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'stores', STORE_ID, 'products', editingProduct.id), productData);
      } else {
        await addDoc(collection(db, 'stores', STORE_ID, 'products'), {
          ...productData,
          createdAt: serverTimestamp()
        });
      }
      setIsProductModalOpen(false);
      setEditingProduct(null);
    } catch (error) {
      console.error("Error guardando:", error);
      alert("Error al guardar. Verifica tu conexión.");
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!user) return;
    if (confirm('¿Estás seguro? Esto se borrará para TODOS los vendedores.')) {
      await deleteDoc(doc(db, 'stores', STORE_ID, 'products', id));
    }
  };

  const handleCheckout = async () => {
    if (!user || cart.length === 0) return;

    try {
      // 1. Guardar la venta en la nube
      await addDoc(collection(db, 'stores', STORE_ID, 'transactions'), {
        type: 'sale',
        total: cartTotal,
        items: cart.map(i => ({ id: i.id, name: i.name, qty: i.qty, price: i.price })),
        sellerId: user.uid, // Opcional: Saber quién vendió
        date: serverTimestamp()
      });

      // 2. Descontar stock en la nube (uno por uno)
      for (const item of cart) {
        // Obtenemos referencia al producto actual para asegurar stock real
        // En una app real usaríamos transacciones (runTransaction)
        const currentProduct = products.find(p => p.id === item.id);
        if (currentProduct) {
          const newStock = Math.max(0, currentProduct.stock - item.qty);
          await updateDoc(doc(db, 'stores', STORE_ID, 'products', item.id), {
            stock: newStock
          });
        }
      }

      setCart([]);
      setShowCheckoutSuccess(true);
      setTimeout(() => setShowCheckoutSuccess(false), 3000);
    } catch (error) {
      console.error("Error checkout:", error);
      alert("Error al procesar venta. Revisa tu conexión.");
    }
  };

  // --- Cálculos ---
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


  // --- Renderizadores ---
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
            {filteredProducts.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No hay productos. Ve a Inventario para agregar uno.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredProducts.map(product => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={product.stock <= 0}
                    className={`flex flex-col items-start p-4 rounded-xl border transition-all ${
                      product.stock > 0 
                        ? 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-md active:scale-95' 
                        : 'bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-3 font-bold text-lg">
                      {product.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="font-semibold text-slate-800 line-clamp-1 w-full text-left">{product.name}</div>
                    <div className="text-sm text-slate-500 w-full text-left">Stock: {product.stock}</div>
                    <div className="mt-2 font-bold text-blue-600">${product.price.toLocaleString()}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={`lg:w-80 bg-white rounded-xl shadow-lg flex flex-col border border-slate-200 ${cart.length === 0 && 'hidden lg:flex'}`}>
          <div className="p-4 border-b border-slate-100 bg-slate-50 rounded-t-xl">
            <h2 className="font-bold text-slate-700 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" /> Ticket de Venta
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="text-center text-slate-400 py-8">
                <p>El carrito está vacío</p>
