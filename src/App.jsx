import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    signInAnonymously,
    onAuthStateChanged,
    signInWithCustomToken
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
    Save
} from 'lucide-react';

// --- CONFIGURACIÓN DE FIREBASE (LIMPIA) ---
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

// ID fijo para la tienda
const appId = 'tienda-principal';

export default function App() {
  const [user, setUser] = useState(null);
  // ... (el resto del código sigue igual)

  // --- Autenticación ---
  useEffect(() => {
    // Inicio de sesión simple y directo
    signInAnonymously(auth).catch((error) => {
      console.error("Error auth:", error);
    });
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

// --- Componente Principal ---
export default function App() {
    const [user, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState('pos'); // pos, inventory, transactions, dashboard
    const [products, setProducts] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [cart, setCart] = useState([]);
    const [loading, setLoading] = useState(true);

    // Estados para formularios y UI
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(false);

    // --- Autenticación e Inicialización ---
    useEffect(() => {
        const initAuth = async () => {
            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                await signInWithCustomToken(auth, __initial_auth_token);
            } else {
                await signInAnonymously(auth);
            }
        };
        initAuth();

        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (!currentUser) setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // --- Carga de Datos (Listeners en tiempo real) ---
    useEffect(() => {
        if (!user) return;

        // Referencia a productos
        const productsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'products');
        const qProducts = query(productsRef, orderBy('name'));

        const unsubProducts = onSnapshot(qProducts, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProducts(items);
            setLoading(false);
        }, (error) => console.error("Error productos:", error));

        // Referencia a transacciones
        // Nota: Usamos query simple para evitar errores de índice en la demo
        const unsubTrans = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'), (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Ordenamiento manual en cliente
            items.sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));
            setTransactions(items);
        }, (error) => console.error("Error transacciones:", error));

        return () => {
            unsubProducts();
            unsubTrans();
        };
    }, [user]);

    // --- Lógica del Carrito (POS) ---
    const addToCart = (product) => {
        if (product.stock <= 0) return; // No vender sin stock

        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                if (existing.qty >= product.stock) return prev; // Límite de stock
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

    // --- Acciones de Base de Datos ---
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
                await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'products', editingProduct.id), productData);
            } else {
                await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'products'), {
                    ...productData,
                    createdAt: serverTimestamp()
                });
            }
            setIsProductModalOpen(false);
            setEditingProduct(null);
        } catch (error) {
            console.error("Error guardando producto:", error);
        }
    };

    const handleDeleteProduct = async (id) => {
        if (!user) return;
        if (confirm('¿Estás seguro de borrar este producto?')) {
            await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'products', id));
        }
    };

    const handleCheckout = async () => {
        if (!user || cart.length === 0) return;

        try {
            // 1. Registrar la venta
            await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'), {
                type: 'sale',
                total: cartTotal,
                items: cart.map(i => ({ id: i.id, name: i.name, qty: i.qty, price: i.price })),
                date: serverTimestamp()
            });

            // 2. Actualizar stock
            for (const item of cart) {
                const currentProduct = products.find(p => p.id === item.id);
                if (currentProduct) {
                    const newStock = Math.max(0, currentProduct.stock - item.qty);
                    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'products', item.id), {
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

    // --- Cálculos de Dashboard ---
    const stats = useMemo(() => {
        const today = new Date().toDateString();
        let totalSales = 0;
        let totalTrans = 0;
        let inventoryValue = 0;

        transactions.forEach(t => {
            // Calcular ventas totales históricas
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


    // --- Renderizadores de Vistas ---

    // 1. VISTA POS
    const renderPOS = () => {
        const filteredProducts = products.filter(p =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase())
        );

        return (
            <div className="flex flex-col h-full lg:flex-row gap-4 overflow-hidden">
                {/* Catálogo de Productos */}
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
                                        className={`flex flex-col items-start p-4 rounded-xl border transition-all ${product.stock > 0
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

                {/* Carrito / Ticket */}
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
                                <p className="text-sm">Selecciona productos para vender</p>
                            </div>
                        ) : (
                            cart.map(item => (
                                <div key={item.id} className="flex items-center justify-between group">
                                    <div className="flex-1">
                                        <div className="font-medium text-slate-800">{item.name}</div>
                                        <div className="text-xs text-slate-500">${item.price} c/u</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => updateCartQty(item.id, -1)} className="w-6 h-6 rounded bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200"><Minus className="w-3 h-3" /></button>
                                        <span className="w-4 text-center text-sm font-medium">{item.qty}</span>
                                        <button onClick={() => updateCartQty(item.id, 1)} className="w-6 h-6 rounded bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200"><Plus className="w-3 h-3" /></button>
                                        <button onClick={() => removeFromCart(item.id)} className="ml-2 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="p-4 bg-slate-50 border-t border-slate-100 rounded-b-xl">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-slate-600 font-medium">Total</span>
                            <span className="text-2xl font-bold text-slate-800">${cartTotal.toLocaleString()}</span>
                        </div>
                        <button
                            onClick={handleCheckout}
                            disabled={cart.length === 0}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3 rounded-lg font-bold shadow-sm active:scale-95 transition-all flex justify-center items-center gap-2"
                        >
                            Cobrar
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // 2. VISTA INVENTARIO
    const renderInventory = () => (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Inventario</h2>
                <button
                    onClick={() => { setEditingProduct(null); setIsProductModalOpen(true); }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm"
                >
                    <Plus className="w-4 h-4" /> Nuevo Producto
                </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-white rounded-xl shadow-sm border border-slate-200">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="p-4 font-semibold text-slate-600">Producto</th>
                            <th className="p-4 font-semibold text-slate-600 text-right">Precio</th>
                            <th className="p-4 font-semibold text-slate-600 text-center">Stock</th>
                            <th className="p-4 font-semibold text-slate-600 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {products.map(p => (
                            <tr key={p.id} className="hover:bg-slate-50">
                                <td className="p-4 text-slate-800 font-medium">{p.name}</td>
                                <td className="p-4 text-right text-slate-600">${p.price}</td>
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.stock === 0 ? 'bg-red-100 text-red-600' :
                                            p.stock < 5 ? 'bg-amber-100 text-amber-600' :
                                                'bg-green-100 text-green-600'
                                        }`}>
                                        {p.stock} u.
                                    </span>
                                </td>
                                <td className="p-4 text-right">
                                    <button onClick={() => { setEditingProduct(p); setIsProductModalOpen(true); }} className="text-blue-500 hover:text-blue-700 mr-3 font-medium text-sm">Editar</button>
                                    <button onClick={() => handleDeleteProduct(p.id)} className="text-red-400 hover:text-red-600 font-medium text-sm">Borrar</button>
                                </td>
                            </tr>
                        ))}
                        {products.length === 0 && (
                            <tr>
                                <td colSpan="4" className="p-8 text-center text-slate-400">
                                    No tienes productos registrados.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    // 3. VISTA TRANSACCIONES
    const renderTransactions = () => (
        <div className="h-full flex flex-col">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Historial de Ventas</h2>
            <div className="flex-1 overflow-y-auto bg-white rounded-xl shadow-sm border border-slate-200 divide-y divide-slate-100">
                {transactions.map(t => (
                    <div key={t.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                        <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${t.type === 'sale' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                                }`}>
                                {t.type === 'sale' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                            </div>
                            <div>
                                <p className="font-medium text-slate-800">
                                    {t.type === 'sale' ? 'Venta' : 'Gasto'}
                                    <span className="text-slate-400 text-sm font-normal ml-2">
                                        {t.date?.seconds ? new Date(t.date.seconds * 1000).toLocaleDateString() : 'Hoy'}
                                    </span>
                                </p>
                                <p className="text-xs text-slate-500">
                                    {t.items ? `${t.items.length} productos: ${t.items.map(i => i.name).join(', ')}` : t.note || 'Sin detalles'}
                                </p>
                            </div>
                        </div>
                        <div className={`font-bold ${t.type === 'sale' ? 'text-green-600' : 'text-slate-800'}`}>
                            {t.type === 'sale' ? '+' : '-'}${t.total?.toLocaleString()}
                        </div>
                    </div>
                ))}
                {transactions.length === 0 && (
                    <div className="p-10 text-center text-slate-400">
                        Aún no hay movimientos.
                    </div>
                )}
            </div>
        </div>
    );

    // 4. VISTA DASHBOARD (RESUMEN)
    const renderDashboard = () => (
        <div className="h-full overflow-y-auto">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Resumen del Negocio</h2>

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

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-center items-center text-center">
                    <h3 className="text-slate-500 font-medium mb-2">Estado del Sistema</h3>
                    <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full text-sm font-medium">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        En línea y Guardando
                    </div>
                </div>
            </div>

            <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white relative overflow-hidden">
                <div className="relative z-10">
                    <h3 className="font-bold text-xl mb-2">Consejo Treinta</h3>
                    <p className="text-slate-300 max-w-lg">
                        Mantener el inventario actualizado es clave para evitar pérdidas. Revisa tu stock al final de cada día.
                    </p>
                </div>
                <History className="absolute right-0 bottom-0 w-32 h-32 text-white opacity-5 -mb-8 -mr-8" />
            </div>
        </div>
    );


    // --- Render Principal ---

    if (loading) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col gap-4">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 font-medium animate-pulse">Cargando tu negocio...</p>
        </div>
    );

    return (
        <div className="flex flex-col h-screen bg-slate-100 font-sans text-slate-900">

            {/* Navbar Superior Mobile/Desktop */}
            <header className="bg-white shadow-sm border-b border-slate-200 px-4 py-3 flex justify-between items-center z-10">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">M</div>
                    <h1 className="font-bold text-xl tracking-tight text-slate-800">MiNegocio <span className="text-blue-600">POS</span></h1>
                </div>
                <div className="text-xs font-medium bg-slate-100 px-3 py-1 rounded-full text-slate-500">
                    ID: {user?.uid.slice(0, 5)}...
                </div>
            </header>

            {/* Contenido Principal */}
            <main className="flex-1 overflow-hidden p-4 pb-24 md:pb-4 max-w-5xl mx-auto w-full">
                {activeTab === 'pos' && renderPOS()}
                {activeTab === 'inventory' && renderInventory()}
                {activeTab === 'transactions' && renderTransactions()}
                {activeTab === 'dashboard' && renderDashboard()}
            </main>

            {/* Menú de Navegación Inferior (Estilo App Nativa) */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 pb-safe flex justify-around items-center h-16 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
                <NavButton active={activeTab === 'pos'} onClick={() => setActiveTab('pos')} icon={<LayoutDashboard size={20} />} label="Vender" />
                <NavButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Package size={20} />} label="Stock" />
                <NavButton active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} icon={<History size={20} />} label="Historial" />
                <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<TrendingUp size={20} />} label="Balance" />
            </nav>

            {/* Navegación Desktop (Sidebar flotante o Header tabs) */}
            <div className="hidden md:flex fixed bottom-8 left-1/2 -translate-x-1/2 bg-white px-6 py-3 rounded-full shadow-xl border border-slate-200 gap-8 items-center z-20">
                <NavButton active={activeTab === 'pos'} onClick={() => setActiveTab('pos')} icon={<LayoutDashboard size={20} />} label="Punto de Venta" />
                <div className="w-px h-6 bg-slate-200"></div>
                <NavButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Package size={20} />} label="Inventario" />
                <div className="w-px h-6 bg-slate-200"></div>
                <NavButton active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} icon={<History size={20} />} label="Transacciones" />
                <div className="w-px h-6 bg-slate-200"></div>
                <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<TrendingUp size={20} />} label="Reportes" />
            </div>

            {/* Modal Agregar/Editar Producto */}
            {isProductModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-lg text-slate-800">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h3>
                            <button onClick={() => setIsProductModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Nombre del Producto</label>
                                <input required name="name" defaultValue={editingProduct?.name} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" placeholder="Ej. Coca Cola 1.5L" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Precio ($)</label>
                                    <input required name="price" type="number" step="0.01" defaultValue={editingProduct?.price} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" placeholder="0.00" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Stock Inicial</label>
                                    <input required name="stock" type="number" defaultValue={editingProduct?.stock} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" placeholder="0" />
                                </div>
                            </div>
                            <div className="pt-2">
                                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg shadow-blue-200 active:scale-95 transition-all flex items-center justify-center gap-2">
                                    <Save className="w-5 h-5" /> Guardar Producto
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Notificación Toast Éxito */}
            {showCheckoutSuccess && (
                <div className="fixed top-20 right-4 md:right-8 bg-green-600 text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-3 animate-in slide-in-from-top duration-300 z-50">
                    <div className="bg-white/20 p-1 rounded-full"><TrendingUp className="w-4 h-4" /></div>
                    <div>
                        <p className="font-bold text-sm">¡Venta Registrada!</p>
                        <p className="text-xs text-green-100">Stock actualizado.</p>
                    </div>
                </div>
            )}

        </div>
    );
}

// Componente Auxiliar NavButton
function NavButton({ active, onClick, icon, label }) {
    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center justify-center gap-1 p-2 transition-all ${active ? 'text-blue-600 scale-105 font-medium' : 'text-slate-400 hover:text-slate-600'
                }`}
        >
            {icon}
            <span className="text-[10px] uppercase tracking-wide">{label}</span>
        </button>
    );

}
