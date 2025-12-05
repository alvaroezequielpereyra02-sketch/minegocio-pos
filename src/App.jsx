import React, { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth';
// Importamos enableIndexedDbPersistence (versión compatibilidad antigua) o configuraciones nuevas según versión
import { initializeFirestore, collection, addDoc, updateDoc, doc, getDoc, setDoc, deleteDoc, onSnapshot, serverTimestamp, query, orderBy, limit, where, getDocs, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { Store, KeyRound, Plus, Phone, MapPin, Edit, Trash2, Tags, Image as ImageIcon, Box, LogOut, ShoppingCart, ChevronRight, Bell, Volume2, WifiOff } from 'lucide-react';

// IMPORTACIÓN DE COMPONENTES CRÍTICOS (Carga inmediata)
import Sidebar, { MobileNav } from './components/Sidebar';
import Cart from './components/Cart';
import ProductGrid from './components/ProductGrid';
import { ExpenseModal, ProductModal, CategoryModal, CustomerModal, StoreModal, AddStockModal, TransactionModal, LogoutConfirmModal, InvitationModal, ProcessingModal, ConfirmModal } from './components/Modals';

// CARGA DIFERIDA (Lazy Loading) para componentes pesados
const Dashboard = lazy(() => import('./components/Dashboard'));
const History = lazy(() => import('./components/History'));
const TransactionDetail = lazy(() => import('./components/TransactionDetail'));
const Orders = lazy(() => import('./components/Orders'));

// CONFIGURACIÓN FIREBASE
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Habilitar caché persistente para Offline
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

const appId = 'tienda-principal';
const NOTIFICATION_SOUND = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

// Mini componente visual para mostrar mientras carga una sección
const TabLoader = () => (
  <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 animate-in fade-in zoom-in">
    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
    <span className="text-xs font-bold">Cargando...</span>
  </div>
);

// FUNCIÓN PARA COMPRIMIR IMÁGENES (Optimización)
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

        // Mantener proporción
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Exportar a JPG comprimido
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
    };
  });
};

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [storeProfile, setStoreProfile] = useState({ name: 'MiNegocio', logoUrl: '' });

  // Estado de conexión
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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
  const [isInvitationModalOpen, setIsInvitationModalOpen] = useState(false);

  // ESTADO PARA CONFIRMACIONES PERSONALIZADAS
  const [confirmConfig, setConfirmConfig] = useState(null);

  // ESTADO DE CARGA
  const [isProcessing, setIsProcessing] = useState(false);

  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [editingTransaction, setEditingTransaction] = useState(null);

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
  const [paymentMethod, setPaymentMethod] = useState('unspecified');

  // Notificación
  const [notification, setNotification] = useState(null);

  // --- MONITOR DE CONEXIÓN ---
  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); setNotification("🟢 Conexión restaurada"); setTimeout(() => setNotification(null), 3000); };
    const handleOffline = () => { setIsOnline(false); setNotification("🔴 Sin conexión (Modo Offline)"); setTimeout(() => setNotification(null), 3000); };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // --- SOLICITAR PERMISO DE NOTIFICACIÓN AL INICIAR ---
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  // --- SONIDO ---
  const playNotificationSound = () => {
    try {
      const audio = new Audio(NOTIFICATION_SOUND);
      audio.play().catch(e => console.log("Audio bloqueado por navegador:", e));
    } catch (error) {
      console.error("Error reproduciendo sonido", error);
    }
  };

  // --- LÓGICA DE NAVEGACIÓN MÓVIL ---
  useEffect(() => {
    const onPopState = (e) => {
      if (selectedTransaction) { e.preventDefault(); setSelectedTransaction(null); }
      else if (showMobileCart) { e.preventDefault(); setShowMobileCart(false); }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [selectedTransaction, showMobileCart]);

  const handleOpenTransactionDetail = useCallback((t) => {
    window.history.pushState({ view: 'transaction' }, document.title);
    setSelectedTransaction(t);
  }, []);

  const handleCloseTransactionDetail = useCallback(() => {
    if (window.history.state && window.history.state.view === 'transaction') window.history.back();
    else setSelectedTransaction(null);
  }, []);

  // --- AUTH & DATA LOADING ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Intentar cargar usuario, con fallback offline silencioso
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            setUserData(userDoc.data());
          } else if (navigator.onLine) {
            // Si hay internet y no existe, salir. Si no hay internet, mantener sesión (puede ser caché)
            await signOut(auth); setUserData(null); setUser(null);
          }
        } catch (e) {
          console.log("Error auth offline (ignorable):", e);
        }
      } else { setUserData(null); }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    // En modo offline, onSnapshot lee de la caché local automáticamente
    const unsubProfile = onSnapshot(doc(db, 'stores', appId, 'settings', 'profile'), (doc) => { if (doc.exists()) setStoreProfile(doc.data()); });
    const unsubProducts = onSnapshot(query(collection(db, 'stores', appId, 'products'), orderBy('name')), (snap) => setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const unsubCats = onSnapshot(query(collection(db, 'stores', appId, 'categories'), orderBy('name')), (snap) => setCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const unsubCustomers = onSnapshot(query(collection(db, 'stores', appId, 'customers'), orderBy('name')), (snap) => setCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const unsubExpenses = onSnapshot(query(collection(db, 'stores', appId, 'expenses'), orderBy('date', 'desc')), (snap) => setExpenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));

    let q;
    // Pequeña optimización: si no hay userData (ej: carga offline inicial lenta), asumir rol basico o esperar
    const role = userData?.role || 'client';

    if (role === 'admin') {
      q = query(collection(db, 'stores', appId, 'transactions'), orderBy('date', 'desc'), limit(500));
    } else {
      q = query(collection(db, 'stores', appId, 'transactions'), where('clientId', '==', user.uid), orderBy('date', 'desc'), limit(6));
    }

    let isFirstLoad = true;
    const unsubTrans = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (role === 'admin' && !isFirstLoad) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const newSale = change.doc.data();
            // IMPORTANTE: hasPendingWrites es true si el cambio es local (offline). No notificar.
            if (newSale.sellerId !== user.uid && !snapshot.metadata.hasPendingWrites) {
              const msg = `💰 Nuevo pedido de ${newSale.clientName} ($${newSale.total})`;
              setNotification(msg);
              setTimeout(() => setNotification(null), 5000);
              playNotificationSound();
            }
          }
        });
      }
      isFirstLoad = false;
      setTransactions(items);
    });

    return () => { unsubProfile(); unsubProducts(); unsubTrans(); unsubCats(); unsubCustomers(); unsubExpenses(); };
  }, [user, userData]); // Dependencia userData añadida

  // --- CÁLCULOS ---
  const balance = useMemo(() => {
    let salesPaid = 0, salesPending = 0, salesPartial = 0, costOfGoodsSold = 0, inventoryValue = 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let todayCash = 0, todayDigital = 0, todayTotal = 0;
    const chartDataMap = {};
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); chartDataMap[d.toLocaleDateString('es-ES', { weekday: 'short' })] = { name: d.toLocaleDateString('es-ES', { weekday: 'short' }), total: 0 }; }
    let totalExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);
    transactions.forEach(t => {
      const tDate = t.date?.seconds ? new Date(t.date.seconds * 1000) : new Date();
      if (t.type === 'sale') {
        if (t.paymentStatus === 'paid') {
          salesPaid += t.total;
          if (t.items) t.items.forEach(item => costOfGoodsSold += (item.cost || 0) * item.qty);
          if (tDate >= today) { todayTotal += t.total; if (t.paymentMethod === 'cash') todayCash += t.total; else todayDigital += t.total; }
          const dayLabel = tDate.toLocaleDateString('es-ES', { weekday: 'short' }); if (chartDataMap[dayLabel]) chartDataMap[dayLabel].total += t.total;
        } else if (t.paymentStatus === 'pending') salesPending += t.total; else if (t.paymentStatus === 'partial') salesPartial += t.total;
      }
    });
    products.forEach(p => { inventoryValue += (p.price * p.stock); });
    const categoryValues = {};
    products.forEach(p => { const catName = categories.find(c => c.id === p.categoryId)?.name || 'Sin Categoría'; if (!categoryValues[catName]) categoryValues[catName] = 0; categoryValues[catName] += (p.price * p.stock); });
    return { salesPaid, salesPending, salesPartial, inventoryValue, totalExpenses, grossProfit: salesPaid - costOfGoodsSold, netProfit: (salesPaid - costOfGoodsSold) - totalExpenses, categoryValues, costOfGoodsSold, todayCash, todayDigital, todayTotal, chartData: Object.values(chartDataMap) };
  }, [transactions, products, expenses, categories]);

  const getCustomerDebt = (customerId) => transactions.filter(t => t.clientId === customerId && t.paymentStatus === 'pending').reduce((acc, t) => acc + t.total, 0);

  // --- FUNCIONES DEL CARRITO ---
  const addToCart = useCallback((product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      return existing ? prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item) : [...prev, { ...product, qty: 1, imageUrl: product.imageUrl }];
    });
  }, []);
  const updateCartQty = useCallback((id, delta) => setCart(prev => prev.map(item => item.id === id ? { ...item, qty: item.qty + delta } : item).filter(i => i.qty > 0 || i.id !== id)), []);
  const setCartItemQty = useCallback((id, newQty) => { const qty = parseInt(newQty); if (!qty || qty < 1) return; setCart(prev => prev.map(item => item.id === id ? { ...item, qty: qty } : item)); }, []);
  const removeFromCart = useCallback((id) => setCart(prev => prev.filter(item => item.id !== id)), []);
  const cartTotal = useMemo(() => cart.reduce((acc, item) => acc + (item.price * item.qty), 0), [cart]);

  // --- HELPERS PARA CONFIRMACIÓN ---
  const requestConfirm = (title, message, action, isDanger = false) => {
    setConfirmConfig({
      title,
      message,
      onConfirm: async () => {
        setConfirmConfig(null);
        await action();
      },
      onCancel: () => setConfirmConfig(null),
      isDanger
    });
  };

  // --- HANDLERS ---
  const handleLogin = async (e) => { e.preventDefault(); try { await signInWithEmailAndPassword(auth, e.target.email.value, e.target.password.value); } catch (error) { setLoginError("Credenciales incorrectas."); } };

  const handleRegister = async (e) => {
    e.preventDefault();
    const form = e.target;
    const inviteCode = form.inviteCode.value.trim().toUpperCase();
    try {
      const codesRef = collection(db, 'stores', appId, 'invitation_codes');
      const q = query(codesRef, where('code', '==', inviteCode), where('status', '==', 'active'));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) throw new Error("Código inválido o usado.");
      const codeDoc = querySnapshot.docs[0];

      const userCredential = await createUserWithEmailAndPassword(auth, form.email.value, form.password.value);
      const newUserData = { email: form.email.value, name: form.name.value, phone: form.phone.value, address: form.address.value, role: 'client', createdAt: serverTimestamp() };
      await setDoc(doc(db, 'users', userCredential.user.uid), newUserData);
      await addDoc(collection(db, 'stores', appId, 'customers'), { name: form.name.value, phone: form.phone.value, address: form.address.value, email: form.email.value, createdAt: serverTimestamp(), platformOrdersCount: 0, externalOrdersCount: 0 });
      await updateDoc(doc(db, 'stores', appId, 'invitation_codes', codeDoc.id), { status: 'used', usedBy: userCredential.user.uid, usedAt: serverTimestamp() });
    } catch (error) { setLoginError(error.message); }
  };

  const handleGenerateCode = async (code) => {
    await addDoc(collection(db, 'stores', appId, 'invitation_codes'), { code, status: 'active', createdAt: serverTimestamp() });
  };

  const handleResetPassword = async () => { const email = document.querySelector('input[name="email"]').value; if (!email) return setLoginError("Escribe tu correo primero."); try { await sendPasswordResetEmail(auth, email); alert("Correo enviado."); setLoginError(""); } catch (error) { setLoginError("Error al enviar correo."); } };
  const handleFinalLogout = () => { signOut(auth); setCart([]); setUserData(null); setIsLogoutConfirmOpen(false); };

  const handleDeleteTransaction = useCallback((id) => {
    requestConfirm(
      "Eliminar Venta",
      "¿Estás seguro de que deseas eliminar esta venta?\nEsta acción no se puede deshacer.",
      async () => {
        try {
          await deleteDoc(doc(db, 'stores', appId, 'transactions', id));
          handleCloseTransactionDetail();
        } catch (error) {
          alert("Error al cancelar.");
        }
      },
      true
    );
  }, [handleCloseTransactionDetail]);

  const handleQuickUpdateTransaction = useCallback(async (id, data) => { try { await updateDoc(doc(db, 'stores', appId, 'transactions', id), data); if (selectedTransaction && selectedTransaction.id === id) setSelectedTransaction(prev => ({ ...prev, ...data })); } catch (error) { alert("Error al actualizar."); } }, [selectedTransaction]);
  const handleUpdateTransaction = async (dataOrEvent) => { if (!editingTransaction) return; let updatedItems = []; let newTotal = 0; if (dataOrEvent.items && typeof dataOrEvent.total === 'number') { updatedItems = dataOrEvent.items; newTotal = dataOrEvent.total; } else { return; } try { await updateDoc(doc(db, 'stores', appId, 'transactions', editingTransaction.id), { items: updatedItems, total: newTotal }); setIsTransactionModalOpen(false); if (selectedTransaction && selectedTransaction.id === editingTransaction.id) setSelectedTransaction(prev => ({ ...prev, items: updatedItems, total: newTotal })); setEditingTransaction(null); } catch (error) { alert("Error"); } };

  // --- FUNCIÓN: EXPORTAR Y PURGAR ---
  const handleExportCSV = async () => {
    if (transactions.length === 0) return alert("No hay datos para exportar.");

    // 1. Descarga del CSV
    const csv = ["Fecha,Cliente,Estado,Total,Pagado,Productos"].concat(
      transactions.map(t =>
        `${new Date(t.date?.seconds * 1000).toLocaleDateString()},${t.clientName},${t.paymentStatus || 'pending'},${t.total},${t.amountPaid || 0},"${t.items?.map(i => `${i.qty} ${i.name}`).join('|')}"`
      )
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ventas_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 2. Proceso de purgado
    setTimeout(() => {
      requestConfirm(
        "¿Purgar Sistema?",
        "✅ Excel descargado correctamente.\n\n¿Deseas ELIMINAR TODO EL HISTORIAL de ventas para limpiar el sistema?\n\n(Úsalo solo si ya guardaste tu respaldo)",
        () => {
          setTimeout(() => {
            requestConfirm(
              "⚠️ ADVERTENCIA FINAL",
              "Se borrarán TODAS las ventas permanentemente.\n\n¿Estás 100% seguro?",
              async () => {
                setIsProcessing(true);
                try {
                  const deletePromises = transactions.map(t => deleteDoc(doc(db, 'stores', appId, 'transactions', t.id)));
                  await Promise.all(deletePromises);
                  setNotification("🧹 Sistema purgado correctamente");
                  setTimeout(() => setNotification(null), 3000);
                } catch (error) {
                  console.error("Error al purgar:", error);
                  alert("Error al intentar borrar algunos datos.");
                } finally {
                  setIsProcessing(false);
                }
              },
              true
            );
          }, 300);
        },
        true
      );
    }, 1000);
  };

  // --- HANDLE CHECKOUT (CORREGIDO PARA OFFLINE) ---
  const handleCheckout = async () => {
    if (!user || cart.length === 0) return;
    setIsProcessing(true); // Mostramos el loader visualmente

    // Datos básicos para crear la venta
    let finalClient = { id: 'anonimo', name: 'Anónimo', role: 'guest' };
    if (userData?.role === 'admin' && selectedCustomer) finalClient = { id: selectedCustomer.id, name: selectedCustomer.name, role: 'customer' };
    else if (userData?.role === 'client') finalClient = { id: user.uid, name: userData.name, role: 'client' };

    const itemsWithCost = cart.map(i => {
      const originalProduct = products.find(p => p.id === i.id);
      return { ...i, cost: originalProduct ? (originalProduct.cost || 0) : 0 };
    });

    const saleData = {
      type: 'sale',
      total: cartTotal,
      amountPaid: 0,
      items: itemsWithCost,
      date: serverTimestamp(),
      clientId: finalClient.id,
      clientName: finalClient.name,
      clientRole: finalClient.role,
      sellerId: user.uid,
      paymentStatus: 'pending',
      paymentNote: '',
      paymentMethod: paymentMethod,
      fulfillmentStatus: 'pending'
    };

    // EJECUCIÓN ROBUSTA PARA OFFLINE
    // No usamos try-catch bloqueante porque en offline addDoc no falla, solo "encola".
    try {
      // 1. Crear Transacción (esto es instantáneo en caché local)
      const docRef = await addDoc(collection(db, 'stores', appId, 'transactions'), saleData);

      // 2. Actualizar Stock (también instantáneo localmente)
      cart.forEach(item => {
        const p = products.find(prod => prod.id === item.id);
        if (p) {
          // Usamos catch individual para que un error no detenga todo el flujo
          updateDoc(doc(db, 'stores', appId, 'products', item.id), { stock: p.stock - item.qty }).catch(err => console.log("Error actualizando stock:", err));
        }
      });

      // 3. Actualizar Cliente (opcional)
      if (finalClient.role === 'client' || finalClient.role === 'customer') {
        let customerDocId = null;
        if (userData?.role === 'admin' && selectedCustomer) {
          customerDocId = selectedCustomer.id;
        } else if (userData?.role === 'client') {
          // Buscar ID del cliente (si ya tenemos customers cargados, mejor buscarlos en memoria)
          const found = customers.find(c => c.email === userData.email);
          if (found) customerDocId = found.id;
        }

        if (customerDocId) {
          updateDoc(doc(db, 'stores', appId, 'customers', customerDocId), {
            externalOrdersCount: (selectedCustomer?.externalOrdersCount || 0) + 1,
            lastPurchase: serverTimestamp()
          }).catch(err => console.log("Error cliente update:", err));
        }
      }

      // 4. Limpiar Interfaz INMEDIATAMENTE (No esperamos confirmación de red)
      setCart([]);
      setSelectedCustomer(null);
      setCustomerSearch('');
      setShowMobileCart(false);
      setPaymentMethod('unspecified');

      setLastTransactionId({ ...saleData, id: docRef.id, date: { seconds: Date.now() / 1000 } });

      // Quitamos el loader rápido para que el usuario siga trabajando
      setIsProcessing(false);
      setShowCheckoutSuccess(true);
      setTimeout(() => setShowCheckoutSuccess(false), 4000);

    } catch (error) {
      console.error("Error crítico en checkout:", error);
      alert("Hubo un problema al guardar la venta. Intenta de nuevo.");
      setIsProcessing(false);
    }
  };

  // --- COMPARTIR PDF POR WHATSAPP (OPTIMIZADO: CARGA DIFERIDA) ---
  const handleShareWhatsApp = async (transaction) => {
    if (!transaction) return;
    setIsProcessing(true);

    try {
      const date = transaction.date?.seconds ? new Date(transaction.date.seconds * 1000).toLocaleString() : 'Reciente';
      const content = `<div style="font-family: sans-serif; padding: 10px; width: 100%; background-color: white; color: black;"><div style="text-align:center; margin-bottom:10px; border-bottom:1px solid #000; padding-bottom:10px;">${storeProfile.logoUrl ? `<img src="${storeProfile.logoUrl}" style="max-width:50px; max-height:50px; margin-bottom:5px; display:block; margin: 0 auto;" />` : ''}<div style="font-size:14px; font-weight:bold; margin-top:5px; text-transform:uppercase;">${storeProfile.name}</div><div style="font-size:10px; margin-top:2px;">Comprobante de Venta</div></div><div style="font-size:11px; margin-bottom:10px; line-height: 1.4;"><div><strong>Fecha:</strong> ${date}</div><div><strong>Cliente:</strong> ${transaction.clientName || 'Consumidor Final'}</div><div><strong>Pago:</strong> ${transaction.paymentMethod === 'cash' ? 'Efectivo' : transaction.paymentMethod === 'transfer' ? 'Transferencia' : 'A definir'}</div></div><div style="text-align:center; font-weight:bold; font-size:12px; margin-bottom:15px; border:1px solid #000; padding:5px; background-color:#f8f8f8;">ESTADO: ${transaction.paymentStatus === 'paid' ? 'PAGADO' : transaction.paymentStatus === 'partial' ? 'PARCIAL' : 'PENDIENTE'}</div><table style="width:100%; border-collapse: collapse; font-size:10px;"><thead><tr style="border-bottom: 2px solid #000;"><th style="text-align:left; padding: 5px 0; width:10%;">Cant</th><th style="text-align:left; padding: 5px 2px; width:50%;">Producto</th><th style="text-align:right; padding: 5px 0; width:20%;">Unit</th><th style="text-align:right; padding: 5px 0; width:20%;">Total</th></tr></thead><tbody>${transaction.items.map(i => `<tr style="border-bottom: 1px solid #ddd;"><td style="text-align:center; padding: 8px 0; vertical-align:top;">${i.qty}</td><td style="text-align:left; padding: 8px 2px; vertical-align:top; word-wrap: break-word;">${i.name}</td><td style="text-align:right; padding: 8px 0; vertical-align:top;">$${i.price}</td><td style="text-align:right; padding: 8px 0; vertical-align:top; font-weight:bold;">$${i.price * i.qty}</td></tr>`).join('')}</tbody></table><div style="margin-top:15px; border-top:2px solid #000; padding-top:10px;"><div style="display:flex; justify-content:space-between; font-size:16px; font-weight:bold;"><span>TOTAL:</span><span>$${transaction.total}</span></div></div>${transaction.paymentNote ? `<div style="margin-top:15px; font-style:italic; font-size:10px; border:1px dashed #aaa; padding:5px;">Nota: ${transaction.paymentNote}</div>` : ''}<div style="text-align:center; margin-top:25px; font-size:10px; color:#666;">¡Gracias por su compra!<br/><strong>${storeProfile.name}</strong></div></div>`;
      const element = document.createElement('div');
      element.innerHTML = content;

      // IMPORTACIÓN DINÁMICA: Solo cargamos la librería aquí
      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = html2pdfModule.default;

      if (!html2pdf) {
        alert("La librería de PDF no está cargada (¿Estás offline?). Intenta de nuevo cuando tengas internet.");
        setIsProcessing(false);
        return;
      }

      const opt = {
        margin: [0, 0, 0, 0],
        filename: `ticket-${transaction.id.slice(0, 5)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: [80, 100 + (transaction.items.length * 10)] }
      };

      const pdfBlob = await html2pdf().set(opt).from(element).output('blob');
      const file = new File([pdfBlob], `ticket-${transaction.id.slice(0, 5)}.pdf`, { type: 'application/pdf' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Comprobante de Venta',
          text: `Adjunto comprobante de venta de ${storeProfile.name}`
        });
      } else {
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ticket-${transaction.id.slice(0, 5)}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        alert("PDF descargado (Compartir no soportado en este navegador).");
      }

    } catch (error) {
      console.error("Error al compartir PDF:", error);
      alert("Error al generar el PDF.");
    } finally {
      setIsProcessing(false);
    }
  };

  // --- IMPRIMIR TICKET (OPTIMIZADO: CARGA DIFERIDA) ---
  const handlePrintTicket = async (transaction) => {
    if (!transaction) return;

    try {
      // IMPORTACIÓN DINÁMICA
      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = html2pdfModule.default;

      const date = transaction.date?.seconds ? new Date(transaction.date.seconds * 1000).toLocaleString() : 'Reciente';
      const content = `<div style="font-family: sans-serif; padding: 10px; width: 100%; background-color: white; color: black;"><div style="text-align:center; margin-bottom:10px; border-bottom:1px solid #000; padding-bottom:10px;">${storeProfile.logoUrl ? `<img src="${storeProfile.logoUrl}" style="max-width:50px; max-height:50px; margin-bottom:5px; display:block; margin: 0 auto;" />` : ''}<div style="font-size:14px; font-weight:bold; margin-top:5px; text-transform:uppercase;">${storeProfile.name}</div><div style="font-size:10px; margin-top:2px;">Comprobante de Venta</div></div><div style="font-size:11px; margin-bottom:10px; line-height: 1.4;"><div><strong>Fecha:</strong> ${date}</div><div><strong>Cliente:</strong> ${transaction.clientName || 'Consumidor Final'}</div><div><strong>Pago:</strong> ${transaction.paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}</div></div><div style="text-align:center; font-weight:bold; font-size:12px; margin-bottom:15px; border:1px solid #000; padding:5px; background-color:#f8f8f8;">ESTADO: ${transaction.paymentStatus === 'paid' ? 'PAGADO' : transaction.paymentStatus === 'partial' ? 'PARCIAL' : 'PENDIENTE'}</div><table style="width:100%; border-collapse: collapse; font-size:10px;"><thead><tr style="border-bottom: 2px solid #000;"><th style="text-align:left; padding: 5px 0; width:10%;">Cant</th><th style="text-align:left; padding: 5px 2px; width:50%;">Producto</th><th style="text-align:right; padding: 5px 0; width:20%;">Unit</th><th style="text-align:right; padding: 5px 0; width:20%;">Total</th></tr></thead><tbody>${transaction.items.map(i => `<tr style="border-bottom: 1px solid #ddd;"><td style="text-align:center; padding: 8px 0; vertical-align:top;">${i.qty}</td><td style="text-align:left; padding: 8px 2px; vertical-align:top; word-wrap: break-word;">${i.name}</td><td style="text-align:right; padding: 8px 0; vertical-align:top;">$${i.price}</td><td style="text-align:right; padding: 8px 0; vertical-align:top; font-weight:bold;">$${i.price * i.qty}</td></tr>`).join('')}</tbody></table><div style="margin-top:15px; border-top:2px solid #000; padding-top:10px;"><div style="display:flex; justify-content:space-between; font-size:16px; font-weight:bold;"><span>TOTAL:</span><span>$${transaction.total}</span></div></div>${transaction.paymentNote ? `<div style="margin-top:15px; font-style:italic; font-size:10px; border:1px dashed #aaa; padding:5px;">Nota: ${transaction.paymentNote}</div>` : ''}<div style="text-align:center; margin-top:25px; font-size:10px; color:#666;">¡Gracias por su compra!<br/><strong>${storeProfile.name}</strong></div></div>`;
      const element = document.createElement('div');
      element.innerHTML = content;

      html2pdf().set({ margin: [0, 0, 0, 0], filename: `ticket-${transaction.id.slice(0, 5)}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: [80, 100 + (transaction.items.length * 10)] } }).from(element).save();
    } catch (error) {
      console.error("Error al imprimir:", error);
      alert("Hubo un problema al cargar el módulo de impresión.");
    }
  };

  // --- ACTUALIZACIÓN DE IMAGEN CON COMPRESIÓN ---
  const handleFileChange = async (e) => {
    const f = e.target.files[0];
    if (f) {
      if (!f.type.startsWith('image/')) return alert("Solo se permiten imágenes");

      try {
        setIsProcessing(true);
        const compressedBase64 = await compressImage(f);
        setPreviewImage(compressedBase64);
        setIsProcessing(false);
      } catch (error) {
        console.error("Error al comprimir:", error);
        alert("Error al procesar la imagen");
        setIsProcessing(false);
      }
    }
  };

  const handleOpenModal = (p = null) => { setEditingProduct(p); setPreviewImage(p?.imageUrl || ''); setImageMode(p?.imageUrl?.startsWith('data:') ? 'file' : 'link'); setIsProductModalOpen(true); };
  const handleBarcodeSubmit = (e) => { e.preventDefault(); if (!barcodeInput) return; const product = products.find(p => p.barcode === barcodeInput); if (product) { addToCart(product); setBarcodeInput(''); } else { alert("Producto no encontrado."); setBarcodeInput(''); } };
  const handleInventoryBarcodeSubmit = (e) => { e.preventDefault(); if (!inventoryBarcodeInput) return; const product = products.find(p => p.barcode === inventoryBarcodeInput); if (product) { setScannedProduct(product); setIsAddStockModalOpen(true); setTimeout(() => quantityInputRef.current?.focus(), 100); setInventoryBarcodeInput(''); } else { requestConfirm("Producto no existe", "¿Crear nuevo producto con este código?", () => { setEditingProduct({ barcode: inventoryBarcodeInput }); setIsProductModalOpen(true); }); setInventoryBarcodeInput(''); } };
  const handleAddStock = async (e) => { e.preventDefault(); const qty = parseInt(e.target.qty.value) || 0; if (scannedProduct && qty !== 0) { const newStock = scannedProduct.stock + qty; try { await updateDoc(doc(db, 'stores', appId, 'products', scannedProduct.id), { stock: newStock }); } catch (e) { alert("Error al actualizar stock"); } } setIsAddStockModalOpen(false); setScannedProduct(null); };

  if (authLoading) return <div className="h-screen flex items-center justify-center bg-slate-50 text-blue-600 font-bold">Cargando...</div>;

  if (!user || !userData) { return (<div className="min-h-screen bg-slate-100 flex items-center justify-center p-4"> <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md"> <div className="text-center mb-6"> {storeProfile.logoUrl ? <img src={storeProfile.logoUrl} className="w-16 h-16 mx-auto mb-2 rounded-xl object-cover shadow-sm" /> : <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-2"><Store size={24} /></div>} <h1 className="text-2xl font-bold text-slate-800">{storeProfile.name}</h1> <p className="text-slate-500 text-sm">Acceso al Sistema</p> </div> <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4"> {isRegistering && (<><input name="name" required className="w-full p-3 border rounded-lg" placeholder="Nombre Completo" /><div className="grid grid-cols-2 gap-2"><input name="phone" required className="w-full p-3 border rounded-lg" placeholder="Teléfono" /><input name="address" required className="w-full p-3 border rounded-lg" placeholder="Dirección" /></div><div className="pt-2 border-t mt-2 bg-blue-50 p-3 rounded-lg border border-blue-100"><p className="text-xs text-blue-600 font-bold mb-1 uppercase">Código de Invitación</p><input name="inviteCode" required className="w-full p-2 border rounded-lg text-center text-lg tracking-widest font-bold uppercase" placeholder="XXXXXX" /></div></>)} <input name="email" type="email" required className="w-full p-3 border rounded-lg" placeholder="Correo" /><input name="password" type="password" required className="w-full p-3 border rounded-lg" placeholder="Contraseña" /> {loginError && <div className="text-red-500 text-sm text-center">{loginError}</div>} <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg">{isRegistering ? 'Registrarse' : 'Entrar'}</button> </form> {!isRegistering && (<button type="button" onClick={handleResetPassword} className="w-full text-slate-400 text-xs hover:text-slate-600 mt-2 flex items-center justify-center gap-1"> <KeyRound size={12} /> ¿Olvidaste tu contraseña? </button>)} <button onClick={() => setIsRegistering(!isRegistering)} className="w-full mt-4 text-blue-600 text-sm font-medium hover:underline">{isRegistering ? 'Volver al Login' : 'Crear Cuenta'}</button> </div> </div>); }

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-900 overflow-hidden relative">
      <Sidebar
        user={user}
        userData={userData}
        storeProfile={storeProfile}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={() => setIsLogoutConfirmOpen(true)}
        onEditStore={() => setIsStoreModalOpen(true)}
      />

      {/* Indicador de Estado de Red */}
      {!isOnline && (
        <div className="fixed bottom-16 left-0 right-0 bg-slate-800 text-white text-xs font-bold py-1 text-center z-[2000] animate-pulse opacity-90">
          <WifiOff size={12} className="inline mr-1" /> MODO OFFLINE: Los datos se sincronizarán al volver la conexión
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN GLOBAL */}
      {confirmConfig && (
        <ConfirmModal
          title={confirmConfig.title}
          message={confirmConfig.message}
          onConfirm={confirmConfig.onConfirm}
          onCancel={confirmConfig.onCancel}
          isDanger={confirmConfig.isDanger}
        />
      )}

      {/* Notificación Toast con Sonido */}
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl z-[1000] animate-in slide-in-from-top-10 fade-in duration-300 flex items-center gap-3" onClick={() => setNotification(null)}>
          <Bell size={18} className="text-yellow-400 animate-bounce" />
          <span className="font-bold text-sm">{notification}</span>
        </div>
      )}

      {/* Pantalla de Carga (Overlay) */}
      {isProcessing && <ProcessingModal />}

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
              <ProductGrid products={products} addToCart={addToCart} searchTerm={searchTerm} setSearchTerm={setSearchTerm} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} categories={categories} userData={userData} barcodeInput={barcodeInput} setBarcodeInput={setBarcodeInput} handleBarcodeSubmit={handleBarcodeSubmit} />
              <div className="hidden lg:block w-80 rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                <Cart cart={cart} updateCartQty={updateCartQty} removeFromCart={removeFromCart} setCartItemQty={setCartItemQty} userData={userData} selectedCustomer={selectedCustomer} setSelectedCustomer={setSelectedCustomer} customerSearch={customerSearch} setCustomerSearch={setCustomerSearch} customers={customers} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} cartTotal={cartTotal} handleCheckout={handleCheckout} setShowMobileCart={setShowMobileCart} />
              </div>
              {showMobileCart && <div className="lg:hidden absolute inset-0 z-[60] bg-white flex flex-col animate-in slide-in-from-bottom duration-200"><Cart cart={cart} updateCartQty={updateCartQty} removeFromCart={removeFromCart} setCartItemQty={setCartItemQty} userData={userData} selectedCustomer={selectedCustomer} setSelectedCustomer={setSelectedCustomer} customerSearch={customerSearch} setCustomerSearch={setCustomerSearch} customers={customers} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} cartTotal={cartTotal} handleCheckout={handleCheckout} setShowMobileCart={setShowMobileCart} /></div>}
              {cart.length > 0 && !showMobileCart && (<button onClick={() => setShowMobileCart(true)} className="lg:hidden absolute bottom-20 left-4 right-4 bg-blue-600 text-white p-4 rounded-xl shadow-2xl flex justify-between items-center z-[55] animate-in fade-in zoom-in"><div className="flex items-center gap-2 font-bold"><ShoppingCart size={20} /> Ver Pedido ({cart.reduce((a, b) => a + b.qty, 0)})</div><div className="font-bold text-lg">${cartTotal} <ChevronRight size={18} className="inline" /></div></button>)}
            </div>
          )}
          {activeTab === 'dashboard' && userData.role === 'admin' && (
            <Suspense fallback={<TabLoader />}>
              <Dashboard balance={balance} expenses={expenses} setIsExpenseModalOpen={setIsExpenseModalOpen} handleDeleteExpense={handleDeleteExpense} />
            </Suspense>
          )}
          {activeTab === 'orders' && userData.role === 'admin' && (
            <Suspense fallback={<TabLoader />}>
              <Orders transactions={transactions} products={products} categories={categories} onUpdateTransaction={handleQuickUpdateTransaction} />
            </Suspense>
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
                <div className="flex gap-2">
                  <button onClick={() => setIsInvitationModalOpen(true)} className="bg-slate-100 text-slate-600 px-3 py-2 rounded-lg flex items-center gap-1 text-sm font-medium"><KeyRound className="w-4 h-4" /> Invitación</button>
                  <button onClick={() => { setEditingCustomer(null); setIsCustomerModalOpen(true); }} className="bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center gap-1 text-sm font-medium"><Plus className="w-4 h-4" /> Cliente</button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto bg-white rounded-xl shadow-sm border divide-y divide-slate-100">
                {customers.map(c => {
                  const debt = getCustomerDebt(c.id);
                  let lastBuyText = "Sin compras";
                  let statusColor = "bg-slate-100 text-slate-500";
                  if (c.lastPurchase?.seconds) {
                    const lastDate = new Date(c.lastPurchase.seconds * 1000);
                    const daysDiff = Math.floor((new Date() - lastDate) / (1000 * 60 * 60 * 24));
                    if (daysDiff === 0) lastBuyText = "Hoy"; else if (daysDiff === 1) lastBuyText = "Ayer"; else lastBuyText = `Hace ${daysDiff} días`;
                    if (daysDiff < 14) statusColor = "bg-green-100 text-green-700"; else if (daysDiff < 30) statusColor = "bg-yellow-100 text-yellow-700"; else statusColor = "bg-red-100 text-red-700";
                  }
                  return (
                    <div key={c.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                      <div>
                        <div className="flex items-center gap-2"><div className="font-bold text-slate-800">{c.name}</div><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${statusColor}`}>{lastBuyText}</span></div>
                        <div className="flex gap-3 text-xs text-slate-500 mt-1"><span className="flex items-center gap-1"><Phone size={12} /> {c.phone}</span><span className="flex items-center gap-1"><MapPin size={12} /> {c.address}</span></div>
                        {debt > 0 && <div className="mt-1 text-xs font-bold text-red-600 bg-red-50 inline-block px-2 py-0.5 rounded">Debe: ${debt.toLocaleString()}</div>}
                        <div className="flex gap-4 mt-2 text-[10px] uppercase font-bold text-slate-400"><span>📱 App: {c.platformOrdersCount || 0}</span><span>👨‍💼 Admin: {c.externalOrdersCount || 0}</span></div>
                      </div>
                      <div className="flex flex-col gap-2"><button onClick={() => { setEditingCustomer(c); setIsCustomerModalOpen(true); }} className="text-blue-600 text-xs font-bold border border-blue-200 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100">Editar</button><button onClick={() => handleDeleteCustomer(c.id)} className="text-red-600 text-xs font-bold border border-red-200 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100">Borrar</button></div>
                    </div>
                  );
                })}
                {customers.length === 0 && <div className="p-8 text-center text-slate-400 text-sm">No hay clientes registrados</div>}
              </div>
            </div>
          )}
          {activeTab === 'transactions' && (
            <Suspense fallback={<TabLoader />}>
              <History transactions={transactions} userData={userData} handleExportCSV={handleExportCSV} historySection={historySection} setHistorySection={setHistorySection} onSelectTransaction={handleOpenTransactionDetail} />
            </Suspense>
          )}
        </main>

        {!showMobileCart && !selectedTransaction && <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} userData={userData} onLogout={() => setIsLogoutConfirmOpen(true)} />}

        {/* TransactionDetail MOVED outside main/nav for z-index */}
        {selectedTransaction && (
          <Suspense fallback={<ProcessingModal />}>
            <TransactionDetail
              transaction={selectedTransaction}
              onClose={handleCloseTransactionDetail}
              onPrint={handlePrintTicket}
              onShare={handleShareWhatsApp}
              onCancel={handleDeleteTransaction}
              customers={customers}
              onUpdate={handleQuickUpdateTransaction}
              onEditItems={(t) => { setEditingTransaction(t); setIsTransactionModalOpen(true); }}
              userData={userData}
            />
          </Suspense>
        )}

        {/* Modales */}
        {isExpenseModalOpen && userData.role === 'admin' && <ExpenseModal onClose={() => setIsExpenseModalOpen(false)} onSave={handleSaveExpense} />}
        {isProductModalOpen && userData.role === 'admin' && <ProductModal onClose={() => setIsProductModalOpen(false)} onSave={handleSaveProduct} onDelete={handleDeleteProduct} editingProduct={editingProduct} imageMode={imageMode} setImageMode={setImageMode} previewImage={previewImage} setPreviewImage={setPreviewImage} handleFileChange={handleFileChange} categories={categories} />}
        {isCategoryModalOpen && userData.role === 'admin' && <CategoryModal onClose={() => setIsCategoryModalOpen(false)} onSave={handleSaveCategory} onDelete={handleDeleteCategory} categories={categories} />}
        {isCustomerModalOpen && userData.role === 'admin' && <CustomerModal onClose={() => setIsCustomerModalOpen(false)} onSave={handleSaveCustomer} editingCustomer={editingCustomer} />}
        {isStoreModalOpen && userData.role === 'admin' && <StoreModal onClose={() => setIsStoreModalOpen(false)} onSave={handleUpdateStore} storeProfile={storeProfile} imageMode={imageMode} setImageMode={setImageMode} previewImage={previewImage} setPreviewImage={setPreviewImage} handleFileChange={handleFileChange} />}
        {isAddStockModalOpen && scannedProduct && <AddStockModal onClose={() => { setIsAddStockModalOpen(false); setScannedProduct(null); }} onConfirm={handleAddStock} scannedProduct={scannedProduct} quantityInputRef={quantityInputRef} />}
        {isTransactionModalOpen && userData.role === 'admin' && editingTransaction && <TransactionModal onClose={() => setIsTransactionModalOpen(false)} onSave={handleUpdateTransaction} editingTransaction={editingTransaction} />}
        {isLogoutConfirmOpen && <LogoutConfirmModal onClose={() => setIsLogoutConfirmOpen(false)} onConfirm={handleFinalLogout} />}
        {isInvitationModalOpen && userData.role === 'admin' && <InvitationModal onClose={() => setIsInvitationModalOpen(false)} onGenerate={handleGenerateCode} />}

        {showCheckoutSuccess && <div className="fixed top-20 right-4 bg-green-600 text-white px-6 py-4 rounded-lg shadow-xl animate-bounce z-[105] flex items-center gap-4"><div><p className="font-bold text-sm">¡Venta Exitosa!</p></div><div className="flex gap-2"><button onClick={() => { handlePrintTicket(lastTransactionId); setShowCheckoutSuccess(false); }} className="bg-white text-green-600 px-3 py-1 rounded text-xs font-bold hover:bg-green-50">Ticket</button></div></div>}
      </div>
    </div>
  );
}