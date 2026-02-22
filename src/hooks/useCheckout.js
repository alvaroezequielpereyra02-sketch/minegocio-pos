import { useState, useEffect, useRef, useCallback } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import { appId } from '../config/firebase';

// ─── Cola offline persistente en localStorage ─────────────────────────────────
const OFFLINE_QUEUE_KEY = 'minegocio_offline_queue';

const getOfflineQueue = () => {
    try { return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]'); }
    catch { return []; }
};
const addToOfflineQueue = (entry) => {
    const q = getOfflineQueue(); q.push(entry);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(q));
};
const removeFromOfflineQueue = (id) => {
    localStorage.setItem(OFFLINE_QUEUE_KEY,
        JSON.stringify(getOfflineQueue().filter(e => e.localId !== id)));
};

export const useCheckout = ({
    user, userData,
    cart, products, cartTotal,
    paymentMethod, selectedCustomer,
    createTransaction, clearCart,
    showNotification
}) => {
    const [isProcessing, setIsProcessing]           = useState(false);
    const [lastSale, setLastSale]                   = useState(null);
    const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(false);
    const [checkoutError, setCheckoutError]         = useState(null);
    // isSyncing: bloquea toda la app mientras sube boletas offline al servidor
    const [isSyncing, setIsSyncing]                 = useState(false);
    const [pendingSync, setPendingSync]             = useState(() => getOfflineQueue().length > 0);

    // Refs sincrónicos — se actualizan en cada render, no necesitan useEffect
    const createTransactionRef = useRef(createTransaction);
    const showNotificationRef  = useRef(showNotification);
    createTransactionRef.current = createTransaction;
    showNotificationRef.current  = showNotification;

    // ─── Proceso de sincronización ────────────────────────────────────────────
    const processOfflineQueue = useCallback(async () => {
        const queue = getOfflineQueue();
        if (queue.length === 0) { setPendingSync(false); return; }

        setIsSyncing(true);
        showNotificationRef.current(`🔄 Sincronizando ${queue.length} boleta(s)...`);

        let synced = 0;
        for (const entry of queue) {
            try {
                const saleData = { ...entry.saleData, date: serverTimestamp() };
                await createTransactionRef.current(saleData, entry.itemsWithCost);
                removeFromOfflineQueue(entry.localId);
                synced++;
            } catch (e) {
                console.error('Error sincronizando boleta offline:', entry.localId, e);
            }
        }

        setIsSyncing(false);

        const remaining = getOfflineQueue().length;
        setPendingSync(remaining > 0);

        if (synced > 0) {
            setCheckoutError(null);
            showNotificationRef.current(`✅ ${synced} boleta(s) sincronizada(s) correctamente.`);
        }
        if (remaining > 0) {
            showNotificationRef.current(`⚠️ ${remaining} boleta(s) no pudieron sincronizarse.`);
        }
    }, []);

    // ── Dispara al autenticarse si hay cola y hay internet ────────────────────
    useEffect(() => {
        if (!user || !navigator.onLine) return;
        if (getOfflineQueue().length === 0) return;
        // 1500ms de espera para que Firestore termine de inicializar
        const t = setTimeout(() => processOfflineQueue(), 1500);
        return () => clearTimeout(t);
    }, [user, processOfflineQueue]);

    // ── Dispara cuando el dispositivo recupera conexión ───────────────────────
    useEffect(() => {
        const handleOnline = () => {
            if (getOfflineQueue().length > 0) processOfflineQueue();
        };
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [processOfflineQueue]);

    // ─── Guardar boleta en localStorage (sin red) ─────────────────────────────
    const saveOffline = ({ itemsWithCost, setShowMobileCart, setSelectedCustomer }) => {
        const client = selectedCustomer
            ? { id: selectedCustomer.id, name: selectedCustomer.name, role: 'customer', address: selectedCustomer.address || '', phone: selectedCustomer.phone || '' }
            : userData?.role === 'client'
                ? { id: user.uid, name: userData.name, role: 'client', address: userData.address || '', phone: userData.phone || '' }
                : { id: 'anonimo', name: 'Anónimo', role: 'guest', address: '', phone: '' };

        const offlineSaleData = {
            type: 'sale',
            total: Number(cartTotal),
            items: itemsWithCost,
            date: { seconds: Math.floor(Date.now() / 1000) },
            deliveryType: 'delivery',
            status: 'pending',
            clientInfo: { name: client.name, address: client.address, phone: client.phone },
            clientId: client.id,
            clientName: client.name,
            clientRole: client.role,
            paymentStatus: 'pending',
            fulfillmentStatus: 'pending',
            sellerId: user.uid,
            paymentMethod: paymentMethod
        };

        const localId = 'offline-' + Date.now();
        addToOfflineQueue({ localId, saleData: offlineSaleData, itemsWithCost });

        setLastSale({ ...offlineSaleData, id: localId });
        clearCart();
        setSelectedCustomer?.(null);
        setShowMobileCart?.(false);
        setPendingSync(true);
        setCheckoutError({
            isPendingSync: true,
            isOffline: true,
            isAdmin: true,
            items: cart.map(i => `${i.qty}x ${i.name}`).join(', '),
            total: cartTotal,
            time: new Date().toLocaleTimeString()
        });
    };

    // ─── Checkout principal ───────────────────────────────────────────────────
    const handleCheckout = async ({ setShowMobileCart, setSelectedCustomer }) => {
        if (!user || cart.length === 0) return;

        const isAdmin  = userData?.role === 'admin';
        const itemsWithCost = cart.map(i => {
            const p = products.find(prod => prod.id === i.id);
            return { id: i.id, name: i.name, qty: Number(i.qty), price: Number(i.price), cost: p ? Number(p.cost || 0) : 0 };
        });

        setCheckoutError(null);

        // ── Sin internet: admin guarda offline al instante, cliente ve error ──
        if (!navigator.onLine) {
            if (isAdmin) {
                saveOffline({ itemsWithCost, setShowMobileCart, setSelectedCustomer });
            } else {
                setCheckoutError({
                    isPendingSync: false,
                    isOffline: true,
                    isAdmin: false,
                    items: cart.map(i => `${i.qty}x ${i.name}`).join(', '),
                    total: cartTotal,
                    time: new Date().toLocaleTimeString()
                });
            }
            return; // ← SIN SPINNER, sin espera
        }

        // ── Con internet: spinner + intento real ─────────────────────────────
        setIsProcessing(true);

        let finalClient = { id: 'anonimo', name: 'Anónimo', role: 'guest', address: '', phone: '' };
        if (isAdmin && selectedCustomer) {
            finalClient = { id: selectedCustomer.id, name: selectedCustomer.name, role: 'customer', address: selectedCustomer.address || '', phone: selectedCustomer.phone || '' };
        } else if (userData?.role === 'client') {
            finalClient = { id: user.uid, name: userData.name, role: 'client', address: userData.address || '', phone: userData.phone || '' };
        }

        const saleData = {
            type: 'sale', total: Number(cartTotal), items: itemsWithCost,
            date: serverTimestamp(), deliveryType: 'delivery', status: 'pending',
            clientInfo: { name: finalClient.name, address: finalClient.address, phone: finalClient.phone },
            clientId: finalClient.id, clientName: finalClient.name, clientRole: finalClient.role,
            paymentStatus: 'pending', fulfillmentStatus: 'pending',
            sellerId: user.uid, paymentMethod: paymentMethod
        };

        try {
            // Timeout de 8s — si no responde, asumimos sin conexión real
            const result = await Promise.race([
                createTransaction(saleData, itemsWithCost),
                new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 8000))
            ]);

            // Notificación al admin si el pedido fue de un cliente
            if (saleData.clientRole === 'client') {
                const ctrl = new AbortController();
                const tid  = setTimeout(() => ctrl.abort(), 8000);
                fetch('/api/notify', {
                    method: 'POST', signal: ctrl.signal,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ transactionId: result.id, clientName: saleData.clientName, total: saleData.total, storeId: appId })
                }).then(() => clearTimeout(tid)).catch(() => clearTimeout(tid));
            }

            setLastSale(result);
            clearCart();
            setSelectedCustomer(null);
            setShowMobileCart(false);
            setShowCheckoutSuccess(true);
            setTimeout(() => setShowCheckoutSuccess(false), 4000);

        } catch (e) {
            console.error('Error en checkout:', e.message);

            if (isAdmin) {
                // Admin: falló estando "online" (señal débil) → guardar offline
                saveOffline({ itemsWithCost, setShowMobileCart, setSelectedCustomer });
            } else {
                setCheckoutError({
                    isPendingSync: false,
                    isOffline: false,
                    isAdmin: false,
                    items: cart.map(i => `${i.qty}x ${i.name}`).join(', '),
                    total: cartTotal,
                    time: new Date().toLocaleTimeString()
                });
            }
        } finally {
            setIsProcessing(false);
        }
    };

    return {
        isProcessing, setIsProcessing,
        lastSale, showCheckoutSuccess, setShowCheckoutSuccess,
        checkoutError, setCheckoutError,
        pendingSync, isSyncing,
        handleCheckout
    };
};
