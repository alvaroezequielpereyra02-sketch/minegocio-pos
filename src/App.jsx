import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, doc, getDoc, setDoc, deleteDoc, onSnapshot, serverTimestamp, query, orderBy, where } from 'firebase/firestore';
import { LayoutDashboard, ShoppingCart, Package, History, Plus, Trash2, Minus, Search, X, TrendingUp, DollarSign, Save, Image as ImageIcon, Upload, Link as LinkIcon, Download, Tags, LogOut, Users, MapPin, Phone, Printer, Menu, Edit, Store, AlertTriangle, ScanBarcode, ArrowLeft, CheckCircle, Clock, AlertCircle, Calculator, Box, Wallet, ChevronRight, XCircle } from 'lucide-react';
// Librería para PDF
import html2pdf from 'html2pdf.js';

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

function NavButton({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-full h-full ${active ? 'text-blue-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}>
      {icon} <span className="text-[10px] uppercase font-bold mt-1">{label}</span>
    </button>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [storeProfile, setStoreProfile] = useState({ name: 'MiNegocio', logoUrl: '' });
  const [activeTab, setActiveTab] = useState('pos');
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [cart, setCart] = useState([]);
  
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) setUserData(userDoc.data());
        else setUserData({ name: 'Usuario', role: 'client' });
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

  const balance = useMemo(() => {
    let salesPaid = 0, salesPending = 0, salesPartial = 0, costOfGoodsSold = 0, inventoryValue = 0;
    let totalExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);
    transactions.forEach(t => {
      if (t.type === 'sale') {
        if (t.paymentStatus === 'paid') {
            salesPaid += t.total;
            if (t.items) t.items.forEach(item => costOfGoodsSold += (item.cost || 0) * item.qty);
        } else if (t.paymentStatus === 'pending') salesPending += t.total;
        else if (t.paymentStatus === 'partial') salesPartial += t.total; 
      }
    });
    products.forEach(p => { inventoryValue += (p.price * p.stock); });
    const grossProfit = salesPaid - costOfGoodsSold;
    const netProfit = grossProfit - totalExpenses;
    const categoryValues = {};
    products.forEach(p => {
        const catName = categories.find(c => c.id === p.categoryId)?.name || 'Sin Categoría';
        if (!categoryValues[catName]) categoryValues[catName] = 0;
        categoryValues[catName] += (p.price * p.stock);
    });
    return { salesPaid, salesPending, salesPartial, inventoryValue, totalExpenses, grossProfit, netProfit, categoryValues, costOfGoodsSold };
  }, [transactions, products, expenses, categories]);

  const handleLogin = async (e) => { e.preventDefault(); try { await signInWithEmailAndPassword(auth, e.target.email.value, e.target.password.value); } catch (error) { setLoginError("Credenciales incorrectas."); } };
  const handleRegister = async (e) => { e.preventDefault(); const form = e.target; try { const userCredential = await createUserWithEmailAndPassword(auth, form.email.value, form.password.value); const role = (form.secretCode?.value === ADMIN_SECRET_CODE) ? 'admin' : 'client'; const newUserData = { email: form.email.value, name: form.name.value, phone: form.phone.value, address: form.address.value, role, createdAt: serverTimestamp() }; await setDoc(doc(db, 'users', userCredential.user.uid), newUserData); if(role === 'client') await addDoc(collection(db, 'stores', appId, 'customers'), { name: form.name.value, phone: form.phone.value, address: form.address.value, email: form.email.value, createdAt: serverTimestamp() }); } catch (error) { setLoginError(error.message); } };
  const handleLogout = () => { signOut(auth); setCart([]); setUserData(null); };

  // --- FUNCIÓN DE TICKET REDISEÑADA ---
  const handlePrintTicket = (transaction) => { 
    if (!transaction) return;
    
    const date = transaction.date?.seconds ? new Date(transaction.date.seconds * 1000).toLocaleString() : 'Reciente';
    const statusText = transaction.paymentStatus === 'paid' ? 'PAGADO' : transaction.paymentStatus === 'partial
