import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, doc, getDoc, setDoc, deleteDoc, onSnapshot, serverTimestamp, query, orderBy, where } from 'firebase/firestore';
// Iconos
import { LayoutDashboard, ShoppingCart, Package, History, Plus, Trash2, Minus, Search, X, TrendingUp, DollarSign, Save, Image as ImageIcon, Upload, Link as LinkIcon, Download, Tags, LogOut, Users, MapPin, Phone, Printer, Menu, Edit, Store, AlertTriangle, ScanBarcode, ArrowLeft, CheckCircle, Clock, AlertCircle, Calculator, Box, Wallet, ChevronRight, XCircle, MessageCircle, CreditCard, Banknote, QrCode, KeyRound } from 'lucide-react';
// Librerías externas
import html2pdf from 'html2pdf.js';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// --- CONFIGURACIÓN FIREBASE ---
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

// --- COMPONENTES UI ---
function NavButton({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-full h-full ${active ? 'text-blue-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}>
      {icon} <span className="text-[10px] uppercase font-bold mt-1">{label}</span>
    </button>
  );
}

// --- LOGICA PRINCIPAL ---
export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [storeProfile, setStoreProfile] = useState({ name: 'MiNegocio', logoUrl: '' });
  
  // Tabs y Modales
  const [activeTab, setActiveTab] = useState('pos');
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  
  // ESTADO NUEVO PARA EL MODAL DE LOGOUT
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  
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
  const [editingTransaction, setEditingTransaction] = useState(null);
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
  
  // Nuevo estado para método de pago
  const [paymentMethod, setPaymentMethod] = useState('cash'); // cash, transfer, card, qr

  // --- AUTH & DATA LOADING ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        
        // 🚨 CORRECCIÓN CLAVE: Si el usuario existe en Auth pero NO en Firestore, lo forzamos a salir.
        if (!userDoc.exists()) {
            console.warn(`User ${currentUser.uid} exists in Auth but not in Firestore. Forcing logout.`);
            await signOut(auth);
            setUserData(null);
            setUser(null);
        } else {
            setUserData(userDoc.data());
        }
      } else { setUserData(null); }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !userData) return;
    const unsubProfile = onSnapshot(doc(db, 'stores', appId, 'settings', 'profile'), (doc) => {
        if (doc.exists()) setStoreProfile(doc.data()); else setStoreProfile({ name: 'Distribuidora P&P', logoUrl: '' });
    });
    const unsubProducts = onSnapshot(query(collection(db, 'stores', appId, 'products'), orderBy('name')), (snap) => setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const unsubCats = onSnapshot(query(collection(db, 'stores', appId, 'categories'), orderBy('name')), (snap) => setCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const unsubCustomers = onSnapshot(query(collection(db, 'stores', appId, 'customers'), orderBy('name')), (snap) => setCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const unsubExpenses = onSnapshot(query(collection(db, 'stores', appId, 'expenses'), orderBy('date', 'desc')), (snap) => setExpenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const unsubTrans = onSnapshot(collection(db, 'stores', appId, 'transactions'), (snapshot) => {
      let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (userData.role !== 'admin') items = items.filter(t => t.clientId === user.uid);
      items.sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));
      setTransactions(items);
    });
    return () => { unsubProfile(); unsubProducts(); unsubTrans(); unsubCats(); unsubCustomers(); unsubExpenses(); };
  }, [user, userData]);

  // --- CALCULOS FINANCIEROS Y GRÁFICOS ---
  const balance = useMemo(() => {
    let salesPaid = 0, salesPending = 0, salesPartial = 0, costOfGoodsSold = 0, inventoryValue = 0;
    
    // Arqueo de hoy
    const today = new Date();
    today.setHours(0,0,0,0);
    let todayCash = 0;
    let todayDigital = 0;
    let todayTotal = 0;

    // Datos para gráfico (Últimos 7 días)
    const chartDataMap = {};
    for(let i=6; i>=0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const label = d.toLocaleDateString('es-ES', { weekday: 'short' });
        chartDataMap[label] = { name: label, total: 0 };
    }

    let totalExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);
    
    transactions.forEach(t => {
      const tDate = t.date?.seconds ? new Date(t.date.seconds * 1000) : new Date();
      
      // Totales generales
      if (t.type === 'sale') {
        if (t.paymentStatus === 'paid') {
            salesPaid += t.total;
            if (t.items) t.items.forEach(item => costOfGoodsSold += (item.cost || 0) * item.qty);
            
            // Lógica Cierre de Caja (Solo pagados hoy)
            if (tDate >= today) {
                todayTotal += t.total;
                if (t.paymentMethod === 'cash') todayCash += t.total;
                else todayDigital += t.total;
            }

            // Lógica Gráfico
            const dayLabel = tDate.toLocaleDateString('es-ES', { weekday: 'short' });
            if (chartDataMap[dayLabel]) {
                chartDataMap[dayLabel].total += t.total;
            }

        } else if (t.paymentStatus === 'pending') salesPending += t.total;
        else if (t.paymentStatus === 'partial') salesPartial += t.total; 
      }
    });
    
    const chartData = Object.values(chartDataMap);

    products.forEach(p => { inventoryValue += (p.price * p.stock); });
    const grossProfit = salesPaid - costOfGoodsSold;
    const netProfit = grossProfit - totalExpenses;
    const categoryValues = {};
    products.forEach(p => {
        const catName = categories.find(c => c.id === p.categoryId)?.name || 'Sin Categoría';
        if (!categoryValues[catName]) categoryValues[catName] = 0;
        categoryValues[catName] += (p.price * p.stock);
    });

    return { 
        salesPaid, salesPending, salesPartial, inventoryValue, totalExpenses, grossProfit, netProfit, categoryValues, costOfGoodsSold,
        todayCash, todayDigital, todayTotal, chartData
    };
  }, [transactions, products, expenses, categories]);

  // Calcula deuda por cliente
  const getCustomerDebt = (customerId) => {
    return transactions
        .filter(t => t.clientId === customerId && t.paymentStatus === 'pending')
        .reduce((acc, t) => acc + t.total, 0);
  };

  const handleLogin = async (e) => { e.preventDefault(); try { await signInWithEmailAndPassword(auth, e.target.email.value, e.target.password.value); } catch (error) { setLoginError("Credenciales incorrectas o cuenta inexistente."); } };
  const handleRegister = async (e) => { e.preventDefault(); const form = e.target; try { const userCredential = await createUserWithEmailAndPassword(auth, form.email.value, form.password.value); const role = (form.secretCode?.value === ADMIN_SECRET_CODE) ? 'admin' : 'client'; const newUserData = { email: form.email.value, name: form.name.value, phone: form.phone.value, address: form.address.value, role, createdAt: serverTimestamp() }; await setDoc(doc(db, 'users', userCredential.user.uid), newUserData); if(role === 'client') await addDoc(collection(db, 'stores', appId, 'customers'), { name: form.name.value, phone: form.phone.value, address: form.address.value, email: form.email.value, createdAt: serverTimestamp() }); } catch (error) { setLoginError(error.message); } };
  
  // --- FUNCIÓN: RESET PASSWORD ---
  const handleResetPassword = async () => {
    const email = document.querySelector('input[name="email"]').value;
    if (!email) {
        setLoginError("Por favor, escribe tu correo arriba primero.");
        return;
    }
    try {
        await sendPasswordResetEmail(auth, email);
        alert("📧 ¡Listo! Revisa tu correo (y la carpeta de Spam). Te enviamos un enlace para restablecer tu contraseña.");
        setLoginError("");
    } catch (error) {
        setLoginError("Error: No pudimos enviar el correo. Verifica que esté bien escrito.");
    }
  };
  
  // --- FUNCIÓN DE CIERRE DE SESIÓN FINAL (Llamada desde el Modal) ---
  const handleFinalLogout = () => {
    signOut(auth);
    setCart([]);
    setUserData(null);
    setIsLogoutConfirmOpen(false); // Cierra el modal después de salir
  };
  
  // --- FUNCIÓN QUE ABRE EL MODAL DE CONFIRMACIÓN (Llamada desde los botones) ---
  const handleLogoutClick = () => {
    setIsLogoutConfirmOpen(true);
  };


// --- FUNCIÓN WHATSAPP AVANZADA (WEB SHARE API) ---
  const handleShareWhatsApp = async (transaction) => {
    if (!transaction) return;

    // 1. Preparamos los datos del ticket (Igual que en imprimir)
    const date = transaction.date?.seconds ? new Date(transaction.date.seconds * 1000).toLocaleString() : 'Reciente';
    const statusText = transaction.paymentStatus === 'paid' ? 'PAGADO' : transaction.paymentStatus === 'partial' ? 'PARCIAL' : 'PENDIENTE';
    // 🚨 MODIFICADO: Solo muestra Efectivo o Transferencia
    const methodText = transaction.paymentMethod === 'cash' ? 'Efectivo' : transaction.paymentMethod === 'transfer' ? 'Transferencia' : 'Otro';

    // 2. Generamos el HTML (El mismo diseño que tu ticket de impresión)
    const content = `
      <div style="font-family: sans-serif; padding: 10px; width: 100%; background-color: white; color: black;">
        <div style="text-align:center; margin-bottom:10px; border-bottom:1px solid #000; padding-bottom:10px;">
          ${storeProfile.logoUrl ? `<img src="${storeProfile.logoUrl}" style="max-width:50px; max-height:50px; margin-bottom:5px; display:block; margin: 0 auto;" />` : ''}
          <div style="font-size:14px; font-weight:bold; margin-top:5px; text-transform:uppercase;">${storeProfile.name}</div>
          <div style="font-size:10px; margin-top:2px;">Comprobante de Venta</div>
        </div>
        <div style="font-size:11px; margin-bottom:10px; line-height: 1.4;">
          <div><strong>Fecha:</strong> ${date}</div>
          <div><strong>Cliente:</strong> ${transaction.clientName || 'Consumidor Final'}</div>
          <div><strong>Pago:</strong> ${methodText}</div>
        </div>
        <div style="text-align:center; font-weight:bold; font-size:12px; margin-bottom:15px; border:1px solid #000; padding:5px; background-color:#f8f8f8;">
          ESTADO: ${statusText}
        </div>
        <table style="width:100%; border-collapse: collapse; font-size:10px;">
          <thead>
            <tr style="border-bottom: 2px solid #000;">
              <th style="text-align:left; padding: 5px 0; width:10%;">Cant</th>
              <th style="text-align:left; padding: 5px 2px; width:50%;">Producto</th>
              <th style="text-align:right; padding: 5px 0; width:20%;">Unit</th>
              <th style="text-align:right; padding: 5px 0; width:20%;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${transaction.items.map(i => `
              <tr style="border-bottom: 1px solid #ddd;">
                <td style="text-align:center; padding: 8px 0; vertical-align:top;">${i.qty}</td>
                <td style="text-align:left; padding: 8px 2px; vertical-align:top; word-wrap: break-word;">${i.name}</td>
                <td style="text-align:right; padding: 8px 0; vertical-align:top;">$${i.price}</td>
                <td style="text-align:right; padding: 8px 0; vertical-align:top; font-weight:bold;">$${i.price * i.qty}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div style="margin-top:15px; border-top:2px solid #000; padding-top:10px;">
           <div style="display:flex; justify-content:space-between; font-size:16px; font-weight:bold;">
              <span>TOTAL:</span>
              <span>$${transaction.total}</span>
           </div>
        </div>
        ${transaction.paymentNote ? `<div style="margin-top:15px; font-style:italic; font-size:10px; border:1px dashed #aaa; padding:5px;">Nota: ${transaction.paymentNote}</div>` : ''}
        <div style="text-align:center; margin-top:25px; font-size:10px; color:#666;">
          ¡Gracias por su compra!<br/><strong>${storeProfile.name}</strong>
        </div>
      </div>
    `;

    // 3. Crear elemento temporal
    const element = document.createElement('div');
    element.innerHTML = content;

    // Configuración PDF
    const opt = { 
        margin: [0, 0, 0, 0], 
        filename: `ticket-${transaction.id.slice(0,5)}.pdf`, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2, useCORS: true, letterRendering: true }, 
        jsPDF: { unit: 'mm', format: [80, 200], orientation: 'portrait' } 
    };

    try {
        // 4. Generar el PDF como un "Blob" (Archivo en memoria)
        const pdfBlob = await html2pdf().set(opt).from(element).output('blob');

        // 5. Crear un archivo físico virtual
        const file = new File([pdfBlob], `ticket-${transaction.id.slice(0,5)}.pdf`, { type: 'application/pdf' });

        // 6. Verificar si el navegador soporta compartir archivos (Casi todos los móviles lo hacen)
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: 'Comprobante de Venta',
                text: `Hola! Aquí tienes tu comprobante de compra en ${storeProfile.name}.`,
            });
        } else {
            alert("Tu dispositivo no soporta compartir archivos directamente. El archivo se descargará.");
            html2pdf().set(opt).from(element).save(); // Fallback: descargar si no puede compartir
        }
    } catch (error) {
        console.error("Error al compartir:", error);
        alert("Hubo un error al intentar compartir. Intenta descargando el ticket.");
    }
  };

  // --- PDF GENERATOR (Descarga Directa) ---
  const handlePrintTicket = (transaction) => { 
    if (!transaction) return;
    const date = transaction.date?.seconds ? new Date(transaction.date.seconds * 1000).toLocaleString() : 'Reciente';
    const statusText = transaction.paymentStatus === 'paid' ? 'PAGADO' : transaction.paymentStatus === 'partial' ? 'PARCIAL' : 'PENDIENTE';
    // 🚨 MODIFICADO: Solo muestra Efectivo o Transferencia
    const methodText = transaction.paymentMethod === 'cash' ? 'Efectivo' : transaction.paymentMethod === 'transfer' ? 'Transferencia' : 'Otro';

    const content = `
      <div style="font-family: sans-serif; padding: 10px; width: 100%; background-color: white; color: black;">
        <div style="text-align:center; margin-bottom:10px; border-bottom:1px solid #000; padding-bottom:10px;">
          ${storeProfile.logoUrl ? `<img src="${storeProfile.logoUrl}" style="max-width:50px; max-height:50px; margin-bottom:5px; display:block; margin: 0 auto;" />` : ''}
          <div style="font-size:14px; font-weight:bold; margin-top:5px; text-transform:uppercase;">${storeProfile.name}</div>
          <div style="font-size:10px; margin-top:2px;">Comprobante de Venta</div>
        </div>
        <div style="font-size:11px; margin-bottom:10px; line-height: 1.4;">
          <div><strong>Fecha:</strong> ${date}</div>
          <div><strong>Cliente:</strong> ${transaction.clientName || 'Consumidor Final'}</div>
          <div><strong>Pago:</strong> ${methodText}</div>
        </div>
        <div style="text-align:center; font-weight:bold; font-size:12px; margin-bottom:15px; border:1px solid #000; padding:5px; background-color:#f8f8f8;">
          ESTADO: ${statusText}
        </div>
        <table style="width:100%; border-collapse: collapse; font-size:10px;">
          <thead>
            <tr style="border-bottom: 2px solid #000;">
              <th style="text-align:left; padding: 5px 0; width:10%;">Cant</th>
              <th style="text-align:left; padding: 5px 2px; width:50%;">Producto</th>
              <th style="text-align:right; padding: 5px 0; width:20%;">Unit</th>
              <th style="text-align:right; padding: 5px 0; width:20%;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${transaction.items.map(i => `
              <tr style="border-bottom: 1px solid #ddd;">
                <td style="text-align:center; padding: 8px 0; vertical-align:top;">${i.qty}</td>
                <td style="text-align:left; padding: 8px 2px; vertical-align:top; word-wrap: break-word;">${i.name}</td>
                <td style="text-align:right; padding: 8px 0; vertical-align:top;">$${i.price}</td>
                <td style="text-align:right; padding: 8px 0; vertical-align:top; font-weight:bold;">$${i.price * i.qty}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div style="margin-top:15px; border-top:2px solid #000; padding-top:10px;">
           <div style="display:flex; justify-content:space-between; font-size:16px; font-weight:bold;">
              <span>TOTAL:</span>
              <span>$${transaction.total}</span>
           </div>
        </div>
        ${transaction.paymentNote ? `<div style="margin-top:15px; font-style:italic; font-size:10px; border:1px dashed #aaa; padding:5px;">Nota: ${transaction.paymentNote}</div>` : ''}
        <div style="text-align:center; margin-top:25px; font-size:10px; color:#666;">
          ¡Gracias por su compra!<br/><strong>${storeProfile.name}</strong>
        </div>
      </div>
    `;

    const element = document.createElement('div');
    element.innerHTML = content;
    const opt = { margin: [0, 0, 0, 0], filename: `ticket-${transaction.id.slice(0,5)}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, letterRendering: true }, jsPDF: { unit: 'mm', format: [80, 200], orientation: 'portrait' } };
    html2pdf().set(opt).from(element).save();
  };

  const handleUpdateStore = async (e) => { e.preventDefault(); const form = e.target; const finalImageUrl = imageMode === 'file' ? previewImage : (form.logoUrlLink?.value || ''); try { await setDoc(doc(db, 'stores', appId, 'settings', 'profile'), { name: form.storeName.value, logoUrl: finalImageUrl }); setIsStoreModalOpen(false); } catch (error) { alert("Error al guardar perfil"); } };
  const addToCart = (product) => { setCart(prev => { const existing = prev.find(item => item.id === product.id); return existing ? prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item) : [...prev, { ...product, qty: 1, imageUrl: product.imageUrl }]; }); };
  const updateCartQty = (id, delta) => setCart(prev => prev.map(item => item.id === id ? { ...item, qty: item.qty + delta } : item).filter(i => i.qty > 0 || i.id !== id));
  const removeFromCart = (id) => setCart(prev => prev.filter(item => item.id !== id));
  const cartTotal = useMemo(() => cart.reduce((acc, item) => acc + (item.price * item.qty), 0), [cart]);
  
  // --- CHECKOUT ACTUALIZADO CON MÉTODO DE PAGO ---
  const handleCheckout = async () => { 
    if (!user || cart.length === 0) return; 
    let finalClient = { id: 'anonimo', name: 'Anónimo', role: 'guest' }; 
    if (userData.role === 'admin' && selectedCustomer) finalClient = { id: selectedCustomer.id, name: selectedCustomer.name, role: 'customer' }; else if (userData.role === 'client') finalClient = { id: user.uid, name: userData.name, role: 'client' }; 
    const itemsWithCost = cart.map(i => { const originalProduct = products.find(p => p.id === i.id); return { ...i, cost: originalProduct ? (originalProduct.cost || 0) : 0 }; });
    
    // Guardamos método de pago en la transacción
    const saleData = { 
        type: 'sale', 
        total: cartTotal, 
        items: itemsWithCost, 
        date: serverTimestamp(), 
        clientId: finalClient.id, 
        clientName: finalClient.name, 
        clientRole: finalClient.role, 
        sellerId: user.uid, 
        paymentStatus: 'pending', 
        paymentNote: '',
        paymentMethod: paymentMethod 
    }; 
    
    try { 
        const docRef = await addDoc(collection(db, 'stores', appId, 'transactions'), saleData); 
        for (const item of cart) { const p = products.find(prod => prod.id === item.id); if (p) await updateDoc(doc(db, 'stores', appId, 'products', item.id), { stock: p.stock - item.qty }); } 
        setCart([]); 
        setSelectedCustomer(null); 
        setCustomerSearch(''); 
        setShowMobileCart(false); 
        // Reset a efectivo por defecto
        setPaymentMethod('cash');
        setLastTransactionId({ ...saleData, id: docRef.id, date: { seconds: Date.now() / 1000 } }); 
        setShowCheckoutSuccess(true); 
        setTimeout(() => setShowCheckoutSuccess(false), 4000); // Un poco más de tiempo para ver los botones
    } catch (error) { alert("Error venta."); } 
  };

  const handleUpdateTransaction = async (e) => { e.preventDefault(); if (!editingTransaction) return; const form = e.target; const updatedItems = editingTransaction.items.map((item, index) => ({ ...item, name: form[`item_name_${index}`].value, qty: parseInt(form[`item_qty_${index}`].value), price: parseFloat(form[`item_price_${index}`].value), cost: item.cost || 0 })); const newTotal = updatedItems.reduce((acc, item) => acc + (item.price * item.qty), 0); try { await updateDoc(doc(db, 'stores', appId, 'transactions', editingTransaction.id), { paymentStatus: form.paymentStatus.value, paymentNote: form.paymentNote.value, items: updatedItems, total: newTotal }); setIsTransactionModalOpen(false); setEditingTransaction(null); } catch (error) { alert("Error al actualizar"); } };
  const handleSaveExpense = async (e) => { e.preventDefault(); const f = e.target; try { await addDoc(collection(db, 'stores', appId, 'expenses'), { description: f.description.value, amount: parseFloat(f.amount.value), date: serverTimestamp() }); setIsExpenseModalOpen(false); } catch (error) { alert("Error al guardar gasto"); } };
  const handleDeleteExpense = async (id) => { if(confirm("¿Eliminar gasto?")) await deleteDoc(doc(db, 'stores', appId, 'expenses', id)); };
  const handleSaveProduct = async (e) => { e.preventDefault(); const f = e.target; const img = imageMode === 'file' ? previewImage : (f.imageUrlLink?.value || ''); const d = { name: f.name.value, barcode: f.barcode.value, price: parseFloat(f.price.value), cost: parseFloat(f.cost.value || 0), stock: parseInt(f.stock.value), categoryId: f.category.value, imageUrl: img }; if (editingProduct) await updateDoc(doc(db, 'stores', appId, 'products', editingProduct.id), d); else await addDoc(collection(db, 'stores', appId, 'products'), { ...d, createdAt: serverTimestamp() }); setIsProductModalOpen(false); };
  const handleSaveCustomer = async (e) => { e.preventDefault(); const f = e.target; const d = { name: f.name.value, phone: f.phone.value, address: f.address.value, email: f.email.value }; try { if(editingCustomer) await updateDoc(doc(db, 'stores', appId, 'customers', editingCustomer.id), d); else await addDoc(collection(db, 'stores', appId, 'customers'), { ...d, createdAt: serverTimestamp() }); setIsCustomerModalOpen(false); } catch (e){alert("Error");} };
  const handleSaveCategory = async (e) => { e.preventDefault(); if(e.target.catName.value) { await addDoc(collection(db, 'stores', appId, 'categories'), { name: e.target.catName.value, createdAt: serverTimestamp() }); setIsCategoryModalOpen(false); } };
  const handleDeleteProduct = async (id) => { if (confirm('¿Borrar?')) await deleteDoc(doc(db, 'stores', appId, 'products', id)); };
  const handleDeleteCategory = async (id) => { if(confirm('¿Borrar?')) await deleteDoc(doc(db, 'stores', appId, 'categories', id)); };
  const handleDeleteCustomer = async (id) => { if(confirm('¿Borrar?')) await deleteDoc(doc(db, 'stores', appId, 'customers', id)); };
  const handleFileChange = (e) => { const f = e.target.files[0]; if (f && f.size <= 800000) { const r = new FileReader(); r.onloadend = () => setPreviewImage(r.result); r.readAsDataURL(f); } };
  const handleOpenModal = (p = null) => { setEditingProduct(p); setPreviewImage(p?.imageUrl||''); setImageMode(p?.imageUrl?.startsWith('data:')?'file':'link'); setIsProductModalOpen(true); };
  const handleBarcodeSubmit = (e) => { e.preventDefault(); if (!barcodeInput) return; const product = products.find(p => p.barcode === barcodeInput); if (product) { addToCart(product); setBarcodeInput(''); } else { alert("Producto no encontrado."); setBarcodeInput(''); } };
  const handleInventoryBarcodeSubmit = (e) => { e.preventDefault(); if (!inventoryBarcodeInput) return; const product = products.find(p => p.barcode === inventoryBarcodeInput); if (product) { setScannedProduct(product); setIsAddStockModalOpen(true); setTimeout(() => quantityInputRef.current?.focus(), 100); setInventoryBarcodeInput(''); } else { if(confirm("Producto no existe. ¿Crear nuevo?")) { setEditingProduct({ barcode: inventoryBarcodeInput }); setIsProductModalOpen(true); } setInventoryBarcodeInput(''); } };
  const handleAddStock = async (e) => { e.preventDefault(); const qty = parseInt(e.target.qty.value) || 0; if (scannedProduct && qty !== 0) { const newStock = scannedProduct.stock + qty; try { await updateDoc(doc(db, 'stores', appId, 'products', scannedProduct.id), { stock: newStock }); } catch(e) { alert("Error al actualizar stock"); } } setIsAddStockModalOpen(false); setScannedProduct(null); };
  
  // --- FUNCIÓN EXPORTAR Y BORRAR HISTORIAL (NUEVA) ---
  const handleExportCSV = async () => {
    if (transactions.length === 0) return alert("No hay datos.");
    
    // 1. Generar y descargar Excel
    const csv = ["Fecha,Cliente,Estado,Total,Productos"].concat(transactions.map(t => `${new Date(t.date?.seconds*1000).toLocaleDateString()},${t.clientName},${t.paymentStatus || 'pending'},${t.total},"${t.items?.map(i=>`${i.qty} ${i.name}`).join('|')}"`)).join('\n');
    const l = document.createElement('a');
    l.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
    l.download = `ventas_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`;
    document.body.appendChild(l);
    l.click();
    document.body.removeChild(l);

    // 2. Preguntar si borrar historial
    setTimeout(async () => {
        if (confirm("⚠️ ATENCIÓN ⚠️\n\n¿Se descargó correctamente el archivo?\n\nSi deseas limpiar el sistema para un nuevo período, acepta aquí para ELIMINAR TODO EL HISTORIAL.\n\n(Esta acción no se puede deshacer)")) {
            const password = prompt("Para confirmar, escribe: BORRAR");
            if (password === "BORRAR") {
                try {
                    // Borramos uno por uno (seguro para evitar límites de batch)
                    const promises = transactions.map(t => deleteDoc(doc(db, 'stores', appId, 'transactions', t.id)));
                    await Promise.all(promises);
                    alert("✅ Historial eliminado correctamente.");
                } catch (error) {
                    alert("Error al borrar: " + error.message);
                }
            } else {
                alert("Operación cancelada. El historial no se borró.");
            }
        }
    }, 1000); // Pequeña pausa para asegurar que la descarga inicie
  };

  if (authLoading) return <div className="h-screen flex items-center justify-center bg-slate-50 text-blue-600 font-bold">Cargando...</div>;

  if (!user || !userData) { return ( <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4"> <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md"> <div className="text-center mb-6"> {storeProfile.logoUrl ? <img src={storeProfile.logoUrl} className="w-16 h-16 mx-auto mb-2 rounded-xl object-cover shadow-sm"/> : <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-2"><Store size={24}/></div>} <h1 className="text-2xl font-bold text-slate-800">{storeProfile.name}</h1> <p className="text-slate-500 text-sm">Acceso al Sistema</p> </div> <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4"> {isRegistering && (<><input name="name" required className="w-full p-3 border rounded-lg" placeholder="Nombre Completo" /><div className="grid grid-cols-2 gap-2"><input name="phone" required className="w-full p-3 border rounded-lg" placeholder="Teléfono" /><input name="address" required className="w-full p-3 border rounded-lg" placeholder="Dirección" /></div><div className="pt-2 border-t mt-2"><p className="text-xs text-slate-400 mb-1">Código Admin (Solo Personal):</p><input name="secretCode" className="w-full p-2 border rounded-lg text-sm" placeholder="Dejar vacío si eres cliente" /></div></>)} <input name="email" type="email" required className="w-full p-3 border rounded-lg" placeholder="Correo" /><input name="password" type="password" required className="w-full p-3 border rounded-lg" placeholder="Contraseña" /> {loginError && <div className="text-red-500 text-sm text-center">{loginError}</div>} <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg">{isRegistering ? 'Registrarse' : 'Entrar'}</button> </form> {!isRegistering && ( <button type="button" onClick={handleResetPassword} className="w-full text-slate-400 text-xs hover:text-slate-600 mt-2 flex items-center justify-center gap-1"> <KeyRound size={12}/> ¿Olvidaste tu contraseña? </button> )} <button onClick={() => setIsRegistering(!isRegistering)} className="w-full mt-4 text-blue-600 text-sm font-medium hover:underline">{isRegistering ? 'Volver al Login' : 'Crear Cuenta'}</button> </div> </div> ); }

  const CartComponent = () => (
    <div className="bg-white h-full flex flex-col">
        <div className="p-4 border-b bg-slate-50 font-bold text-slate-700 flex justify-between items-center"><span className="flex gap-2"><ShoppingCart className="w-5 h-5" /> Ticket</span><button onClick={() => setShowMobileCart(false)} className="lg:hidden p-1 bg-slate-200 rounded-full"><X size={20}/></button></div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">{cart.map(item => (<div key={item.id} className="flex items-center gap-3"><div className="flex-1 min-w-0"><div className="font-medium text-sm truncate">{item.name}</div><div className="text-xs text-slate-500">${item.price} x {item.qty}</div></div><div className="flex items-center gap-1"><button onClick={() => updateCartQty(item.id, -1)} className="w-6 h-6 bg-slate-100 rounded flex items-center justify-center"><Minus className="w-3 h-3"/></button><button onClick={() => updateCartQty(item.id, 1)} className="w-6 h-6 bg-slate-100 rounded flex items-center justify-center"><Plus className="w-3 h-3"/></button><button onClick={() => removeFromCart(item.id)} className="ml-1 text-red-400"><Trash2 className="w-4 h-4"/></button></div></div>))}{cart.length === 0 && <div className="text-center text-slate-400 mt-10">Carrito vacío</div>}</div>
        <div className="p-4 bg-slate-50 border-t space-y-3">
            {userData.role === 'admin' && (<div className="relative">{selectedCustomer ? (<div className="flex items-center justify-between bg-blue-50 p-2 rounded border border-blue-100"><div><div className="text-sm font-bold text-blue-800">{selectedCustomer.name}</div><div className="text-xs text-blue-600">{selectedCustomer.phone}</div></div><button onClick={()=>setSelectedCustomer(null)} className="text-blue-400"><X size={16}/></button></div>) : (<div><div className="flex items-center gap-2 border rounded p-2 bg-white"><Search size={16} className="text-slate-400"/><input className="w-full text-sm outline-none" placeholder="Buscar cliente..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)}/></div>{customerSearch && (<div className="absolute left-0 right-0 bottom-full mb-1 bg-white border rounded shadow-lg max-h-40 overflow-y-auto z-10">{customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase())).map(c => (<button key={c.id} onClick={()=>{setSelectedCustomer(c); setCustomerSearch('');}} className="w-full text-left p-2 hover:bg-slate-50 text-sm border-b"><div className="font-bold">{c.name}</div><div className="text-xs text-slate-500">{c.phone}</div></button>))}</div>)}</div>)}</div>)}
            
            {/* --- SELECCIÓN MÉTODO DE PAGO (SOLO EFECTIVO/TRANSFERENCIA) --- */}
            <div className="flex gap-2">
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full p-2 border rounded bg-slate-50 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="cash">💵 Efectivo</option>
                    <option value="transfer">🏦 Transferencia</option>
                    {/* Tarjeta y QR eliminados */}
                </select>
            </div>

            <div className="flex justify-between font-bold text-slate-800"><span>Total</span><span>${cartTotal}</span></div>
            <button onClick={handleCheckout} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">Cobrar</button>
        </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-900 overflow-hidden">
      <div className="hidden lg:flex flex-col w-64 bg-white border-r z-20 shrink-0">
        <div className="p-4 border-b flex items-center gap-2 font-bold text-xl text-slate-800"><div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white"><Store size={18}/></div><span className="truncate">{storeProfile.name}</span></div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-1"><button onClick={() => setActiveTab('pos')} className={`w-full text-left p-3 rounded-lg flex gap-3 items-center font-medium ${activeTab==='pos'?'bg-blue-50 text-blue-700':'text-slate-600 hover:bg-slate-50'}`}><LayoutDashboard size={20}/> Vender</button>{userData.role === 'admin' && (<><button onClick={() => setActiveTab('inventory')} className={`w-full text-left p-3 rounded-lg flex gap-3 items-center font-medium ${activeTab==='inventory'?'bg-blue-50 text-blue-700':'text-slate-600 hover:bg-slate-50'}`}><Package size={20}/> Inventario</button><button onClick={() => setActiveTab('customers')} className={`w-full text-left p-3 rounded-lg flex gap-3 items-center font-medium ${activeTab==='customers'?'bg-blue-50 text-blue-700':'text-slate-600 hover:bg-slate-50'}`}><Users size={20}/> Clientes</button><button onClick={() => setActiveTab('dashboard')} className={`w-full text-left p-3 rounded-lg flex gap-3 items-center font-medium ${activeTab==='dashboard'?'bg-blue-50 text-blue-700':'text-slate-600 hover:bg-slate-50'}`}><TrendingUp size={20}/> Balance</button></>)}<button onClick={() => setActiveTab('transactions')} className={`w-full text-left p-3 rounded-lg flex gap-3 items-center font-medium ${activeTab==='transactions'?'bg-blue-50 text-blue-700':'text-slate-600 hover:bg-slate-50'}`}><History size={20}/> Historial</button></nav>
        <div className="p-4 border-t"><div className="flex items-center gap-3 mb-4"><div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold">{userData.name.charAt(0)}</div><div className="overflow-hidden"><div className="text-sm font-bold truncate">{userData.name}</div><div className="text-xs text-slate-500 capitalize">{userData.role === 'admin' ? 'Admin' : 'Cliente'}</div></div></div><button onClick={handleLogoutClick} className="w-full p-2 border rounded-lg flex items-center justify-center gap-2 text-sm text-red-600 hover:bg-red-50"><LogOut size={16}/> Salir</button></div>
      </div>
      <div className="flex flex-col flex-1 min-w-0 h-full">
        <header className="lg:hidden bg-white shadow-sm border-b px-4 py-3 flex justify-between items-center z-[50] shrink-0 h-16"><button onClick={() => userData.role === 'admin' && setIsStoreModalOpen(true)} className="flex items-center gap-2 font-bold text-lg text-slate-800 truncate">{storeProfile.logoUrl ? <img src={storeProfile.logoUrl} className="w-8 h-8 object-cover rounded" /> : <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white"><Store size={16}/></div>}<span className="truncate max-w-[150px]">{storeProfile.name}</span></button><div className="flex gap-3"><button onClick={handleLogoutClick} className="bg-slate-100 p-2 rounded-full text-slate-600"><LogOut size={18}/></button></div></header>
        <main className="flex-1 overflow-hidden p-4 relative z-0 flex flex-col">
            {activeTab === 'pos' && (<div className="flex flex-col h-full lg:flex-row gap-4 overflow-hidden relative"><div className="flex-1 flex flex-col min-h-0"><div className="mb-3 flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-3 text-slate-400 w-5 h-5" /><input className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 outline-none" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
                    {/* 🚨 OCULTAR LECTOR DE CÓDIGO A CLIENTES */}
                    {userData.role === 'admin' && (
                        <form onSubmit={handleBarcodeSubmit} className="relative w-48 hidden sm:block">
                            <ScanBarcode className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                            <input className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 outline-none bg-white" placeholder="Escanear..." value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)} autoFocus/>
                        </form>
                    )}
                </div><div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide"><button onClick={() => setSelectedCategory('all')} className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${selectedCategory === 'all' ? 'bg-blue-600 text-white' : 'bg-white border'}`}>Todos</button>{categories.map(cat => (<button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${selectedCategory === cat.id ? 'bg-blue-600 text-white' : 'bg-white border'}`}>{cat.name}</button>))}</div><div className="flex-1 overflow-y-auto pr-2 pb-24 lg:pb-0"><div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">{products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) && (selectedCategory === 'all' || p.categoryId === selectedCategory)).map(product => (<button key={product.id} onClick={() => addToCart(product)} className="flex flex-col items-start p-0 rounded-xl border bg-white shadow-sm overflow-hidden active:scale-95 transition-all relative"><div className="w-full h-32 bg-slate-100 relative">{product.imageUrl ? <img src={product.imageUrl} className="w-full h-full object-cover" onError={(e)=>{e.target.src='https://via.placeholder.com/150'}} /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon className="w-8 h-8"/></div>}<div className={`absolute top-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${product.stock <= 0 ? 'bg-red-500 text-white' : 'bg-white/90 text-slate-700'}`}>{product.stock}</div></div><div className="p-3 w-full text-left"><div className="font-semibold text-slate-800 text-sm truncate">{product.name}</div><div className="font-bold text-blue-600 text-sm">${product.price}</div></div></button>))}</div></div></div><div className="hidden lg:block w-80 rounded-xl shadow-lg border border-slate-200 overflow-hidden"><CartComponent /></div>{showMobileCart && <div className="lg:hidden absolute inset-0 z-[60] bg-white flex flex-col animate-in slide-in-from-bottom duration-200"><CartComponent /></div>}{cart.length > 0 && !showMobileCart && (<button onClick={() => setShowMobileCart(true)} className="lg:hidden absolute bottom-20 left-4 right-4 bg-blue-600 text-white p-4 rounded-xl shadow-2xl flex justify-between items-center z-[55] animate-in fade-in zoom-in"><div className="flex items-center gap-2 font-bold"><ShoppingCart size={20}/> Ver Pedido ({cart.reduce((a,b)=>a+b.qty,0)})</div><div className="font-bold text-lg">${cartTotal} <ChevronRight size={18} className="inline"/></div></button>)}</div>)}
            {activeTab === 'dashboard' && userData.role === 'admin' && (<div className="flex flex-col h-full overflow-hidden pb-20 lg:pb-0"><div className="flex justify-between items-center mb-6 flex-shrink-0"><h2 className="text-xl font-bold text-slate-800">Balance Financiero</h2><button onClick={() => setIsExpenseModalOpen(true)} className="bg-red-100 text-red-600 px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-bold hover:bg-red-200"><Wallet size={16}/> Gasto</button></div><div className="flex-1 overflow-y-auto pr-2 space-y-6">
                
                {/* --- SECCIÓN NUEVA: CIERRE DE CAJA --- */}
                <div className="bg-slate-800 p-6 rounded-xl shadow-lg text-white">
                    <h3 className="text-sm font-bold text-slate-300 uppercase mb-4">Resumen del Día (Hoy)</h3>
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="bg-slate-700 p-3 rounded-lg">
                            <div className="text-xs text-slate-400 mb-1">Efectivo</div>
                            <div className="text-xl font-bold text-green-400">${balance.todayCash.toLocaleString()}</div>
                        </div>
                        <div className="bg-slate-700 p-3 rounded-lg">
                            <div className="text-xs text-slate-400 mb-1">Digital (Bancos)</div>
                            <div className="text-xl font-bold text-blue-400">${balance.todayDigital.toLocaleString()}</div>
                        </div>
                        <div className="bg-slate-700 p-3 rounded-lg border border-slate-500">
                            <div className="text-xs text-slate-400 mb-1">Total Vendido</div>
                            <div className="text-xl font-bold text-white">${balance.todayTotal.toLocaleString()}</div>
                        </div>
                    </div>
                </div>

                {/* --- SECCIÓN NUEVA: GRÁFICOS --- */}
                <div className="bg-white p-6 rounded-xl shadow-sm border h-80">
                    <h3 className="font-bold text-slate-700 mb-4">Ventas: Últimos 7 Días</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={balance.chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" tick={{fontSize: 10}} />
                            <YAxis tick={{fontSize: 10}} />
                            <Tooltip formatter={(value) => [`$${value}`, 'Venta']} />
                            <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]}>
                                {balance.chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index === 6 ? '#16a34a' : '#2563eb'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"><div className="bg-white p-4 rounded-xl shadow-sm border border-l-4 border-l-green-500"><div className="text-slate-500 text-xs font-bold uppercase mb-1">Ventas Totales</div><div className="text-2xl font-bold text-green-700">${balance.salesPaid.toLocaleString()}</div></div><div className="bg-white p-4 rounded-xl shadow-sm border border-l-4 border-l-blue-500"><div className="text-slate-500 text-xs font-bold uppercase mb-1">Costo Mercadería</div><div className="text-2xl font-bold text-blue-600">-${balance.costOfGoodsSold.toLocaleString()}</div></div><div className="bg-white p-4 rounded-xl shadow-sm border border-l-4 border-l-red-500"><div className="text-slate-500 text-xs font-bold uppercase mb-1">Gastos Operativos</div><div className="text-2xl font-bold text-red-600">-${balance.totalExpenses.toLocaleString()}</div></div><div className="bg-white p-4 rounded-xl shadow-sm border border-l-4 border-l-emerald-500"><div className="text-slate-500 text-xs font-bold uppercase mb-1">Ganancia Neta</div><div className="text-2xl font-bold text-emerald-600">${balance.netProfit.toLocaleString()}</div></div></div><div className="bg-white p-6 rounded-xl shadow-sm border"><h3 className="font-bold text-slate-700 mb-4">Estado de Cobros</h3><div className="flex items-end gap-4 h-32"><div className="flex-1 flex flex-col justify-end items-center gap-2 h-full"><div className="w-full bg-green-100 rounded-t-lg relative group transition-all hover:bg-green-200" style={{height: `${Math.min(100, (balance.salesPaid / (balance.salesPaid + balance.salesPending + 1)) * 100)}%`}}><div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-green-700 opacity-0 group-hover:opacity-100">${balance.salesPaid}</div></div><span className="text-xs text-slate-500 font-bold">Cobrado</span></div><div className="flex-1 flex flex-col justify-end items-center gap-2 h-full"><div className="w-full bg-orange-100 rounded-t-lg relative group transition-all hover:bg-orange-200" style={{height: `${Math.min(100, (balance.salesPending / (balance.salesPaid + balance.salesPending + 1)) * 100)}%`}}><div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-orange-700 opacity-0 group-hover:opacity-100">${balance.salesPending}</div></div><span className="text-xs text-slate-500 font-bold">Por Cobrar</span></div></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="bg-white p-6 rounded-xl shadow-sm border"><h3 className="font-bold text-slate-700 mb-4">Stock por Categoría</h3><div className="space-y-3">{Object.entries(balance.categoryValues).map(([cat, val]) => (<div key={cat} className="flex justify-between items-center text-sm"><span className="text-slate-600">{cat}</span><span className="font-bold text-slate-800">${val.toLocaleString()}</span></div>))}</div></div><div className="bg-white p-6 rounded-xl shadow-sm border"><h3 className="font-bold text-slate-700 mb-4">Gastos Recientes</h3><div className="space-y-2 max-h-48 overflow-y-auto">{expenses.map(exp => (<div key={exp.id} className="flex justify-between text-sm p-2 hover:bg-slate-50 rounded"><div><div className="font-medium text-slate-700">{exp.description}</div><div className="text-xs text-slate-400">{new Date(exp.date?.seconds * 1000).toLocaleDateString()}</div></div><div className="flex items-center gap-2"><span className="font-bold text-red-500">-${exp.amount}</span><button onClick={() => handleDeleteExpense(exp.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={12}/></button></div></div>))}</div></div></div></div></div>)}
            {activeTab === 'inventory' && userData.role === 'admin' && (<div className="flex flex-col h-full overflow-hidden pb-20 lg:pb-0"><div className="flex justify-between items-center mb-4 flex-shrink-0"><h2 className="text-xl font-bold text-slate-800">Inventario</h2><div className="flex gap-2"><button onClick={() => setIsCategoryModalOpen(true)} className="bg-slate-100 text-slate-600 px-3 py-2 rounded-lg flex items-center gap-1 text-sm font-medium"><Tags className="w-4 h-4" /> Cats</button><button onClick={() => handleOpenModal()} className="bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center gap-1 text-sm font-medium"><Plus className="w-4 h-4" /> Prod</button></div></div><div className="mb-4 flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-3 text-slate-400 w-5 h-5" /><input className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 outline-none" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div><form onSubmit={handleInventoryBarcodeSubmit} className="relative w-48 hidden sm:block"><ScanBarcode className="absolute left-3 top-3 text-slate-400 w-5 h-5" /><input className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 outline-none bg-green-50" placeholder="Entrada Stock..." value={inventoryBarcodeInput} onChange={(e) => setInventoryBarcodeInput(e.target.value)} autoFocus/></form></div><div className="flex-1 overflow-y-auto pr-2"><div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">{products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(product => (<button key={product.id} onClick={() => handleOpenModal(product)} className="flex flex-col items-start p-0 rounded-xl border bg-white shadow-sm overflow-hidden hover:ring-2 hover:ring-blue-400 transition-all text-left relative group"><div className="w-full h-32 bg-slate-100 relative">{product.imageUrl ? <img src={product.imageUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon className="w-8 h-8"/></div>}<div className={`absolute top-1 right-1 px-2 py-0.5 rounded text-xs font-bold shadow-sm ${product.stock <= 0 ? 'bg-red-600 text-white' : 'bg-white/90 text-slate-700'}`}>{product.stock}</div></div><div className="p-3 w-full"><div className="font-semibold text-slate-800 text-sm truncate">{product.name}</div><div className="flex justify-between items-end mt-1"><div><div className="text-[10px] text-slate-400">Costo: ${product.cost || 0}</div><div className="font-bold text-blue-600 text-sm">${product.price}</div></div><Edit size={14} className="text-slate-300 group-hover:text-blue-500 mb-1"/></div></div>{product.stock < 0 && (<div className="absolute top-0 left-0 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-br-lg font-bold flex items-center gap-1"><AlertTriangle size={10}/> Deuda: {Math.abs(product.stock)}</div>)}</button>))}</div></div></div>)}
            {activeTab === 'customers' && userData.role === 'admin' && (<div className="flex flex-col h-full overflow-hidden pb-20 lg:pb-0"><div className="flex justify-between items-center mb-4 flex-shrink-0"><h2 className="text-xl font-bold">Clientes</h2><button onClick={() => {setEditingCustomer(null); setIsCustomerModalOpen(true);}} className="bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center gap-1 text-sm font-medium"><Plus className="w-4 h-4" /> Cliente</button></div><div className="flex-1 overflow-y-auto bg-white rounded-xl shadow-sm border">{customers.map(c => { const debt = getCustomerDebt(c.id); return (<div key={c.id} className="p-4 border-b flex justify-between items-center hover:bg-slate-50"><div><div className="font-bold text-slate-800">{c.name}</div><div className="flex gap-3 text-xs text-slate-500 mt-1"><span className="flex items-center gap-1"><Phone size={12}/> {c.phone}</span><span className="flex items-center gap-1"><MapPin size={12}/> {c.address}</span></div>{debt > 0 && <div className="mt-1 text-xs font-bold text-red-600 bg-red-50 inline-block px-2 py-0.5 rounded">Debe: ${debt}</div>}</div><div className="flex gap-2"><button onClick={()=>{setEditingCustomer(c); setIsCustomerModalOpen(true);}} className="text-blue-600 text-xs font-bold border px-2 py-1 rounded">Edit</button><button onClick={()=>handleDeleteCustomer(c.id)} className="text-red-600 text-xs font-bold border px-2 py-1 rounded">Del</button></div></div>); })}</div></div>)}
            {activeTab === 'transactions' && (<div className="flex flex-col h-full overflow-hidden pb-20 lg:pb-0"><div className="flex justify-between items-center mb-4 flex-shrink-0"><h2 className="text-xl font-bold">Historial</h2>{userData.role === 'admin' && <button onClick={handleExportCSV} className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm flex gap-2"><Download size={16}/> Excel</button>}</div>{historySection === 'menu' ? (<div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 overflow-y-auto"><button onClick={() => setHistorySection('paid')} className="bg-green-50 border border-green-200 p-6 rounded-2xl flex flex-col items-center justify-center hover:bg-green-100 transition-all shadow-sm"><div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white mb-4"><CheckCircle size={32}/></div><h3 className="text-xl font-bold text-green-800">Pagados</h3><p className="text-sm text-green-600">Ventas completadas</p></button><button onClick={() => setHistorySection('pending')} className="bg-red-50 border border-red-200 p-6 rounded-2xl flex flex-col items-center justify-center hover:bg-red-100 transition-all shadow-sm"><div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center text-white mb-4"><AlertCircle size={32}/></div><h3 className="text-xl font-bold text-red-800">Pendientes</h3><p className="text-sm text-red-600">Ventas por cobrar</p></button><button onClick={() => setHistorySection('partial')} className="bg-orange-50 border border-orange-200 p-6 rounded-2xl flex flex-col items-center justify-center hover:bg-orange-100 transition-all shadow-sm"><div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center text-white mb-4"><Clock size={32}/></div><h3 className="text-xl font-bold text-orange-800">Parciales</h3><p className="text-sm text-orange-600">Pagos incompletos</p></button></div>) : (<div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl shadow-sm border overflow-hidden"><div className={`p-4 flex items-center gap-4 border-b ${historySection === 'paid' ? 'bg-green-50' : historySection === 'pending' ? 'bg-red-50' : 'bg-orange-50'}`}><button onClick={() => setHistorySection('menu')} className="p-2 bg-white rounded-full shadow-sm hover:scale-105 transition-transform"><ArrowLeft size={20}/></button><h3 className="text-lg font-bold capitalize">{historySection === 'paid' ? 'Pagados' : historySection === 'pending' ? 'Pendientes' : 'Parciales'}</h3></div><div className="flex-1 overflow-y-auto divide-y">{transactions.filter(t => (t.paymentStatus || 'pending') === historySection).map(t => (<div key={t.id} className="p-4 flex justify-between items-center hover:bg-slate-50"><div><p className="font-medium">{t.clientName || 'Anónimo'} <span className="text-slate-400 font-normal ml-2">{new Date(t.date?.seconds * 1000).toLocaleTimeString()}</span></p><p className="text-xs text-slate-500 truncate w-48 mt-1">{t.items?.map(i => `${i.qty} ${i.name}`).join(', ')}</p>{t.paymentNote && <p className="text-xs text-slate-500 italic mt-1 bg-slate-100 inline-block px-1 rounded">{t.paymentNote}</p>}<div className="mt-1 flex gap-2">{t.paymentMethod && <span className="text-[10px] bg-slate-200 px-1.5 rounded uppercase font-bold text-slate-600">{t.paymentMethod}</span>}</div></div><div className="flex items-center gap-2"><div className="font-bold text-slate-800">${t.total}</div>{userData.role === 'admin' && (<button onClick={() => {setEditingTransaction(t); setIsTransactionModalOpen(true);}} className="p-2 bg-slate-100 rounded-full hover:bg-blue-100 text-blue-600"><Edit size={14} /></button>)}<button onClick={() => handlePrintTicket(t)} className="p-2 bg-slate-100 rounded-full hover:bg-green-100 text-green-600"><Printer size={14} /></button><button onClick={() => handleShareWhatsApp(t)} className="p-2 bg-green-50 rounded-full hover:bg-green-100 text-green-600"><MessageCircle size={14} /></button></div></div>))}</div></div>)}</div>)}
        </main>
        
        {!showMobileCart && (
          <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 flex justify-around items-center z-[50] shadow-lg"><NavButton active={activeTab === 'pos'} onClick={() => setActiveTab('pos')} icon={<LayoutDashboard size={24} />} label="Vender" />{userData.role === 'admin' && <NavButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Package size={24} />} label="Stock" />}{userData.role === 'admin' && <NavButton active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} icon={<Users size={24} />} label="Clientes" />}<NavButton active={activeTab === 'transactions'} onClick={() => {setActiveTab('transactions'); setHistorySection('menu');}} icon={<History size={24} />} label="Historial" />{userData.role === 'admin' && <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<TrendingUp size={24} />} label="Balance" />}</nav>
        )}

        {isExpenseModalOpen && userData.role === 'admin' && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100] backdrop-blur-sm"><div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl"><div className="flex justify-between items-center"><h3 className="font-bold text-lg text-red-600">Registrar Gasto</h3><button onClick={() => setIsExpenseModalOpen(false)}><X size={20}/></button></div><form onSubmit={handleSaveExpense} className="space-y-3"><label className="block text-sm text-slate-500">Descripción</label><input name="description" required className="w-full p-2 border rounded" placeholder="Ej: Combustible, Luz..." /><label className="block text-sm text-slate-500">Monto</label><input name="amount" type="number" required className="w-full p-2 border rounded text-red-600 font-bold" placeholder="0.00" /><button type="submit" className="w-full bg-red-600 text-white font-bold py-2 rounded">Guardar Gasto</button></form></div></div>)}
        {isProductModalOpen && userData.role === 'admin' && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100] backdrop-blur-sm"><div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]"><div className="flex justify-between items-center"><h3 className="font-bold text-lg">{editingProduct ? 'Editar' : 'Nuevo'} Producto</h3>{editingProduct && <button onClick={() => handleDeleteProduct(editingProduct.id)} className="text-red-500 text-sm underline">Eliminar</button>}</div><form onSubmit={handleSaveProduct} className="space-y-3"><input required name="name" defaultValue={editingProduct?.name} className="w-full p-2 border rounded" placeholder="Nombre" /><div className="flex gap-2 items-center border p-2 rounded bg-slate-50"><ScanBarcode size={16} className="text-slate-400"/><input name="barcode" defaultValue={editingProduct?.barcode} className="w-full bg-transparent outline-none text-sm" placeholder="Código de Barras (Opcional)" /></div><div className="grid grid-cols-2 gap-2"><div><label className="text-xs text-slate-500 font-bold">Precio Venta</label><input required name="price" type="number" defaultValue={editingProduct?.price} className="w-full p-2 border rounded" /></div><div><label className="text-xs text-slate-500 font-bold">Costo Compra</label><input name="cost" type="number" defaultValue={editingProduct?.cost || ''} className="w-full p-2 border rounded" placeholder="0.00" /></div></div><div><label className="text-xs text-slate-500 font-bold">Stock</label><input required name="stock" type="number" defaultValue={editingProduct?.stock} className="w-full p-2 border rounded" /></div><select name="category" defaultValue={editingProduct?.categoryId || ""} className="w-full p-2 border rounded bg-white"><option value="">Sin Categoría</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><div className="flex gap-2 bg-slate-100 p-1 rounded"><button type="button" onClick={()=>{setImageMode('file'); setPreviewImage('')}} className={`flex-1 py-1 text-xs rounded ${imageMode==='file'?'bg-white shadow':''}`}>Subir</button><button type="button" onClick={()=>{setImageMode('link'); setPreviewImage('')}} className={`flex-1 py-1 text-xs rounded ${imageMode==='link'?'bg-white shadow':''}`}>Link</button></div>{imageMode === 'file' ? <input type="file" accept="image/*" onChange={handleFileChange} className="text-sm w-full" /> : <input name="imageUrlLink" defaultValue={!editingProduct?.imageUrl?.startsWith('data:')?editingProduct?.imageUrl:''} className="w-full p-2 border rounded text-sm" placeholder="URL imagen..." onChange={(e)=>setPreviewImage(e.target.value)} />}{previewImage && <img src={previewImage} className="h-20 w-full object-cover rounded border" />}<div className="flex gap-2 pt-2"><button type="button" onClick={() => setIsProductModalOpen(false)} className="flex-1 py-2 text-slate-500">Cancelar</button><button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded font-bold">Guardar</button></div></form></div></div>)}
        {isCategoryModalOpen && userData.role === 'admin' && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100] backdrop-blur-sm"><div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl"><div className="flex justify-between items-center"><h3 className="font-bold text-lg">Categorías</h3><button onClick={()=>setIsCategoryModalOpen(false)}><X size={20}/></button></div><div className="max-h-40 overflow-y-auto space-y-2 border-b pb-4">{categories.map(cat => (<div key={cat.id} className="flex justify-between items-center bg-slate-50 p-2 rounded"><span>{cat.name}</span><button onClick={() => handleDeleteCategory(cat.id)} className="text-red-400"><Trash2 size={16}/></button></div>))}</div><form onSubmit={handleSaveCategory} className="flex gap-2"><input name="catName" required className="flex-1 p-2 border rounded text-sm" placeholder="Nueva..." /><button type="submit" className="bg-green-600 text-white px-4 rounded font-bold">+</button></form></div></div>)}
        {isCustomerModalOpen && userData.role === 'admin' && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100] backdrop-blur-sm"><div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl"><h3 className="font-bold text-lg">{editingCustomer ? 'Editar' : 'Nuevo'} Cliente</h3><form onSubmit={handleSaveCustomer} className="space-y-3"><input required name="name" defaultValue={editingCustomer?.name} className="w-full p-2 border rounded" placeholder="Nombre Completo" /><input required name="phone" defaultValue={editingCustomer?.phone} className="w-full p-2 border rounded" placeholder="Teléfono" /><input required name="address" defaultValue={editingCustomer?.address} className="w-full p-2 border rounded" placeholder="Dirección" /><input name="email" type="email" defaultValue={editingCustomer?.email} className="w-full p-2 border rounded" placeholder="Email (Opcional)" /><div className="flex gap-2 pt-2"><button type="button" onClick={() => setIsCustomerModalOpen(false)} className="flex-1 py-2 text-slate-500">Cancelar</button><button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded font-bold">Guardar</button></div></form></div></div>)}
        {isStoreModalOpen && userData.role === 'admin' && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100] backdrop-blur-sm"><div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl"><div className="flex justify-between items-center"><h3 className="font-bold text-lg">Perfil del Negocio</h3><button onClick={() => setIsStoreModalOpen(false)}><X size={20}/></button></div><form onSubmit={handleUpdateStore} className="space-y-4"><div><label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label><input name="storeName" defaultValue={storeProfile.name} required className="w-full p-2 border rounded" /></div><div><label className="block text-sm font-medium text-slate-700 mb-2">Logo</label><div className="flex gap-2 mb-3 bg-slate-100 p-1 rounded-lg"><button type="button" onClick={() => { setImageMode('file'); setPreviewImage(''); }} className={`flex-1 py-1.5 text-xs rounded-md ${imageMode === 'file' ? 'bg-white shadow text-blue-600 font-bold' : 'text-slate-500'}`}>Subir</button><button type="button" onClick={() => { setImageMode('link'); setPreviewImage(''); }} className={`flex-1 py-1.5 text-xs rounded-md ${imageMode === 'link' ? 'bg-white shadow text-blue-600 font-bold' : 'text-slate-500'}`}>Link</button></div>{imageMode === 'file' ? (<input type="file" accept="image/*" onChange={handleFileChange} className="text-sm w-full" />) : (<input name="logoUrlLink" defaultValue={!storeProfile.logoUrl?.startsWith('data:') ? storeProfile.logoUrl : ''} className="w-full p-2 border rounded text-sm" placeholder="URL del logo..." onChange={(e) => setPreviewImage(e.target.value)} />)}{(previewImage || storeProfile.logoUrl) && (<div className="mt-3 flex justify-center"><img src={previewImage || storeProfile.logoUrl} className="h-20 w-20 object-cover rounded-xl border shadow-sm" /></div>)}</div><button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700">Guardar Cambios</button></form></div></div>)}
        {isAddStockModalOpen && scannedProduct && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[105] backdrop-blur-sm"><div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl text-center"><div className="flex items-center gap-3 justify-center mb-2"><Box size={32} className="text-blue-600"/><h3 className="font-bold text-lg text-slate-800">Entrada Stock</h3></div><div className="bg-slate-100 p-3 rounded-lg"><div className="font-bold text-lg">{scannedProduct.name}</div><div className="text-sm text-slate-500">Stock Actual: {scannedProduct.stock}</div></div><form onSubmit={handleAddStock}><label className="block text-sm text-slate-500 mb-2">Cantidad a sumar:</label><input ref={quantityInputRef} name="qty" type="number" defaultValue="1" min="1" className="w-32 p-3 border-2 border-blue-500 rounded-lg text-center text-2xl font-bold mx-auto block mb-4" /><div className="flex gap-2"><button type="button" onClick={()=>{setIsAddStockModalOpen(false); setScannedProduct(null);}} className="flex-1 py-3 text-slate-500 font-bold bg-slate-100 rounded-lg">Cancelar</button><button type="submit" className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-lg">Confirmar</button></div></form></div></div>)}
        {isTransactionModalOpen && userData.role === 'admin' && editingTransaction && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100] backdrop-blur-sm"><div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]"><div className="flex justify-between items-center"><h3 className="font-bold text-lg">Editar Boleta</h3><button onClick={() => setIsTransactionModalOpen(false)}><X size={20}/></button></div><form onSubmit={handleUpdateTransaction} className="space-y-4"><div className="bg-slate-50 rounded-lg border overflow-hidden"><table className="w-full text-sm text-left"><thead className="bg-slate-200 text-slate-700 font-bold"><tr><th className="p-2 w-16">Cant</th><th className="p-2">Producto</th><th className="p-2 w-20 text-right">Precio ($)</th></tr></thead><tbody className="divide-y divide-slate-200">{editingTransaction.items.map((item, index) => (<tr key={index} className="bg-white"><td className="p-2"><input name={`item_qty_${index}`} defaultValue={item.qty} type="number" className="w-full p-1 border rounded text-center" /></td><td className="p-2"><input name={`item_name_${index}`} defaultValue={item.name} className="w-full p-1 border rounded" /></td><td className="p-2"><input name={`item_price_${index}`} defaultValue={item.price} type="number" className="w-full p-1 border rounded text-right" /></td></tr>))}</tbody></table></div><div className="grid grid-cols-2 gap-3"><div><label className="block text-sm font-medium text-slate-700 mb-1">Estado</label><select name="paymentStatus" defaultValue={editingTransaction?.paymentStatus || 'pending'} className="w-full p-2 border rounded bg-white text-sm"><option value="paid">✅ Pagado</option><option value="pending">❌ Pendiente</option><option value="partial">⚠️ Parcial</option></select></div><div><label className="block text-sm font-medium text-slate-700 mb-1">Nota</label><input name="paymentNote" defaultValue={editingTransaction?.paymentNote || ''} className="w-full p-2 border rounded text-sm" placeholder="Detalles..." /></div></div><button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700">Guardar Cambios</button></form></div></div>)}
        {showCheckoutSuccess && <div className="fixed top-20 right-4 bg-green-600 text-white px-6 py-4 rounded-lg shadow-xl animate-bounce z-[105] flex items-center gap-4"><div><p className="font-bold text-sm">¡Venta Exitosa!</p></div><div className="flex gap-2"><button onClick={() => {handlePrintTicket(lastTransactionId); setShowCheckoutSuccess(false);}} className="bg-white text-green-600 px-3 py-1 rounded text-xs font-bold hover:bg-green-50">Ticket</button><button onClick={() => {handleShareWhatsApp(lastTransactionId); setShowCheckoutSuccess(false);}} className="bg-white text-green-600 px-3 py-1 rounded text-xs font-bold hover:bg-green-50">WhatsApp</button></div></div>}

        {/* --- MODAL DE CONFIRMACIÓN DE CIERRE DE SESIÓN --- */}
        {isLogoutConfirmOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[110] backdrop-blur-sm">
                <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl text-center">
                    <AlertTriangle size={32} className="text-orange-500 mx-auto"/>
                    <h3 className="font-bold text-lg text-slate-800">Cerrar Sesión</h3>
                    <p className="text-sm text-slate-600">⚠️ ¿Estás seguro de que quieres cerrar la sesión? Perderás el acceso hasta que vuelvas a iniciar sesión.</p>
                    <div className="flex gap-3 pt-2">
                        <button 
                            type="button" 
                            onClick={() => setIsLogoutConfirmOpen(false)} 
                            className="flex-1 py-3 text-slate-700 font-bold bg-slate-100 rounded-lg hover:bg-slate-200">
                            Cancelar
                        </button>
                        <button 
                            type="button" 
                            onClick={handleFinalLogout} // Llama a la lógica de cierre de sesión
                            className="flex-1 bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-700">
                            <LogOut size={18} className="inline mr-1"/>
                            Sí, Salir
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
