import { useState, useEffect, useRef, useCallback } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import { appId } from '../config/firebase';

const CHECKOUT_TIMEOUT_MS = 8000;
const RETRY_DELAY_MS = 3000;
const MAX_RETRIES = 2;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const withTimeout = (promise, ms) =>
    Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), ms)
        )
    ]);

// ─── Cola offline persistente en localStorage ─────────────────────────────────
const OFFLINE_QUEUE_KEY = 'minegocio_offline_queue';

const getOfflineQueue = () => {
    try { return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]'); }
    catch { return []; }
};

const addToOfflineQueue = (entry) => {
    const queue = getOfflineQueue();
    queue.push(entry);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
};

const removeFromOfflineQueue = (id) => {
    const queue = getOfflineQueue().filter(e => e.localId !== id);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
};

// ✅ Ping real a Firebase — navigator.onLine no es confiable en Android con señal débil.
// Si este fetch falla, no hay internet real aunque el sistema diga que sí.
const checkRealConnectivity = async () => {
    try {
        await withTimeout(
            fetch('https://firestore.googleapis.com/v1/projects/minegocio-pos-e35bf/databases/(default)/documents', {
                method: 'HEAD',
                cache: 'no-store'
            }),
            3000
        );
        return true;
    } catch {
        return false;
    }
};

export const useCheckout = ({
    user, userData,
    cart, products, cartTotal,
    paymentMethod, selectedCustomer,
    createTransaction, clearCart,
    showNotification
}) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [lastSale, setLastSale] = useState(null);
    const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(false);
    const [checkoutError, setCheckoutError] = useState(null);
    const [pendingSync, setPendingSync] = useState(() => getOfflineQueue().length > 0);

    // ✅ Refs estables — evitan que los efectos se re-ejecuten en cada render
    const createTransactionRef = useRef(createTransaction);
    const showNotificationRef = useRef(showNotification);
    // Actualizamos los refs sincrónicamente en cada render (sin useEffect)
    // para que estén disponibles de inmediato cuando los efectos disparen
    createTransactionRef.current = createTransaction;
    showNotificationRef.current = showNotification;

    const processOfflineQueue = useCallback(async () => {
        const queue = getOfflineQueue();
        if (queue.length === 0) return;

        showNotificationRef.current(`🔄 Sincronizando ${queue.length} pedido(s) guardado(s)...`);

        let synced = 0;
        for (const entry of queue) {
            try {
                const saleData = { ...entry.saleData, date: serverTimestamp() };
                await createTransactionRef.current(saleData, entry.itemsWithCost);
                removeFromOfflineQueue(entry.localId);
                synced++;
            } catch (e) {
                console.error('Error sincronizando pedido offline:', entry.localId, e);
            }
        }

        if (synced > 0) {
            showNotificationRef.current(`✅ ${synced} pedido(s) sincronizado(s) correctamente.`);
            setPendingSync(getOfflineQueue().length > 0);
            setCheckoutError(null);
        }
    }, []); // Sin dependencias — usa refs que se actualizan sincrónicamente

    // ✅ Dispara cuando el usuario se autentica y hay cola pendiente
    useEffect(() => {
        if (!user || !navigator.onLine) return;
        if (getOfflineQueue().length === 0) return;
        const timer = setTimeout(() => processOfflineQueue(), 1500);
        return () => clearTimeout(timer);
    }, [user, processOfflineQueue]);

    // ✅ Dispara cuando vuelve la conexión
    useEffect(() => {
        const handleOnline = () => {
            if (getOfflineQueue().length > 0) processOfflineQueue();
        };
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [processOfflineQueue]);

    // ─── Helpers para guardar offline ─────────────────────────────────────────
    const buildItemsWithCost = () =>
        cart.map(i => {
            const p = products.find(prod => prod.id === i.id);
            return { id: i.id, name: i.name, qty: Number(i.qty), price: Number(i.price), cost: p ? Number(p.cost || 0) : 0 };
        });

    const buildOfflineSaleData = (itemsWithCost) => {
        const client = selectedCustomer
            ? { id: selectedCustomer.id, name: selectedCustomer.name, role: 'customer', address: selectedCustomer.address || '', phone: selectedCustomer.phone || '' }
            : userData?.role === 'client'
                ? { id: user.uid, name: userData.name, role: 'client', address: userData.address || '', phone: userData.phone || '' }
                : { id: 'anonimo', name: 'Anónimo', role: 'guest', address: '', phone: '' };

        return {
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
    };

    const saveOffline = (itemsWithCost, offlineSaleData) => {
        const localId = 'offline-' + Date.now();
        addToOfflineQueue({ localId, saleData: offlineSaleData, itemsWithCost });
        setLastSale({ ...offlineSaleData, id: localId });
        clearCart();
        setSelectedCustomer?.(null);
        setPendingSync(true);
        setCheckoutError({
            message: 'Pedido guardado sin conexión.',
            items: cart.map(i => `${i.qty}x ${i.name}`).join(', '),
            total: cartTotal,
            time: new Date().toLocaleTimeString(),
            isOffline: true,
            isAdmin: true,
            isPendingSync: true
        });
    };

    const handleCheckout = async ({ setShowMobileCart, setSelectedCustomer }) => {
        if (!user || cart.length === 0) return;

        const isAdmin = userData?.role === 'admin';
        const itemsWithCost = buildItemsWithCost();
        const offlineSaleData = buildOfflineSaleData(itemsWithCost);

        setCheckoutError(null);

        // ✅ PASO 1: Verificamos conectividad real ANTES del spinner
        // navigator.onLine no es confiable — hacemos un ping real a Firebase (3s timeout)
        const hasRealConnection = await checkRealConnectivity();

        if (!hasRealConnection) {
            if (isAdmin) {
                // Admin sin internet real: guardar en localStorage sin mostrar spinner
                saveOffline(itemsWithCost, offlineSaleData);
                setShowMobileCart(false);
            } else {
                // Cliente sin internet: bloquear
                setCheckoutError({
                    message: 'Sin conexión a internet.',
                    items: cart.map(i => `${i.qty}x ${i.name}`).join(', '),
                    total: cartTotal,
                    time: new Date().toLocaleTimeString(),
                    isOffline: true,
                    isAdmin: false,
                    isPendingSync: false
                });
            }
            return;
        }

        // ✅ PASO 2: Hay conexión real — activamos spinner y procesamos
        setIsProcessing(true);

        let finalClient = { id: 'anonimo', name: 'Anónimo', role: 'guest', address: '', phone: '' };
        if (isAdmin && selectedCustomer) {
            finalClient = { id: selectedCustomer.id, name: selectedCustomer.name, role: 'customer', address: selectedCustomer.address || '', phone: selectedCustomer.phone || '' };
        } else if (userData?.role === 'client') {
            finalClient = { id: user.uid, name: userData.name, role: 'client', address: userData.address || '', phone: userData.phone || '' };
        }

        const saleData = {
            type: 'sale',
            total: Number(cartTotal),
            items: itemsWithCost,
            date: serverTimestamp(),
            deliveryType: 'delivery',
            status: 'pending',
            clientInfo: { name: finalClient.name, address: finalClient.address, phone: finalClient.phone },
            clientId: finalClient.id,
            clientName: finalClient.name,
            clientRole: finalClient.role,
            paymentStatus: 'pending',
            fulfillmentStatus: 'pending',
            sellerId: user.uid,
            paymentMethod: paymentMethod
        };

        const attemptTransaction = async () => {
            const result = await withTimeout(createTransaction(saleData, itemsWithCost), CHECKOUT_TIMEOUT_MS);

            if (saleData.clientRole === 'client') {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000);
                fetch('/api/notify', {
                    method: 'POST', signal: controller.signal,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ transactionId: result.id, clientName: saleData.clientName, total: saleData.total, storeId: appId })
                }).then(() => clearTimeout(timeoutId)).catch(err => { clearTimeout(timeoutId); console.error("Error notificación:", err); });
            }
            return result;
        };

        try {
            const result = await attemptTransaction();
            setLastSale(result);
            clearCart();
            setSelectedCustomer(null);
            setShowMobileCart(false);
            setShowCheckoutSuccess(true);
            setTimeout(() => setShowCheckoutSuccess(false), 4000);

        } catch (e) {
            console.error("Error en checkout:", e.message);

            // ✅ Si falló a pesar del ping exitoso (perdió conexión a mitad),
            // admin va a offline directamente. Cliente reintenta.
            if (isAdmin) {
                setIsProcessing(false);
                saveOffline(itemsWithCost, offlineSaleData);
                setShowMobileCart(false);
                return;
            }

            let success = false;
            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                try {
                    showNotification(`⏳ Reintentando pedido (${attempt}/${MAX_RETRIES})...`);
                    await sleep(RETRY_DELAY_MS);
                    const result = await attemptTransaction();
                    setLastSale(result);
                    clearCart();
                    setSelectedCustomer(null);
                    setShowMobileCart(false);
                    setShowCheckoutSuccess(true);
                    setTimeout(() => setShowCheckoutSuccess(false), 4000);
                    success = true;
                    break;
                } catch (retryError) {
                    console.error(`Error en reintento ${attempt}:`, retryError.message);
                }
            }

            if (!success) {
                setCheckoutError({
                    message: 'No se pudo enviar el pedido. Verificá tu conexión.',
                    items: cart.map(i => `${i.qty}x ${i.name}`).join(', '),
                    total: cartTotal,
                    time: new Date().toLocaleTimeString(),
                    isOffline: false,
                    isAdmin: false,
                    isPendingSync: false
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
        pendingSync,
        handleCheckout
    };
};
