import { useState, useEffect, useRef, useCallback } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import { appId } from '../config/firebase';

// ─── Cola offline persistente en localStorage ─────────────────────────────────
// Sobrevive cierres de app. Se procesa cuando el admin vuelve con conexión.
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

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3000;
const CHECKOUT_TIMEOUT_MS = 5000; // Falla rápido — si no responde en 5s, probablemente sin internet real

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const withTimeout = (promise, ms) =>
    Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), ms)
        )
    ]);

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
    // ✅ Inicializamos desde localStorage — si había cola al cerrar la app, pendingSync arranca en true
    const [pendingSync, setPendingSync] = useState(() => getOfflineQueue().length > 0);

    // ✅ Refs para acceder a la versión más reciente de las funciones sin re-ejecutar efectos
    const createTransactionRef = useRef(createTransaction);
    useEffect(() => { createTransactionRef.current = createTransaction; }, [createTransaction]);
    const showNotificationRef = useRef(showNotification);
    useEffect(() => { showNotificationRef.current = showNotification; }, [showNotification]);

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
    }, []); // Sin dependencias — usa refs internamente

    // ✅ Efecto 1: dispara cuando el usuario está autenticado y hay cola pendiente.
    // Usamos `user` como señal de que Firebase ya inicializó completamente.
    // Sin esto, createTransaction puede ejecutarse antes de que Auth esté lista.
    useEffect(() => {
        if (!user) return; // Esperar a que Auth esté lista
        if (!navigator.onLine) return;
        if (getOfflineQueue().length === 0) return;

        const timer = setTimeout(() => processOfflineQueue(), 1500);
        return () => clearTimeout(timer);
    }, [user, processOfflineQueue]); // Se re-ejecuta cuando el usuario se autentica

    // ✅ Efecto 2: listener de reconexión
    useEffect(() => {
        const handleOnline = () => processOfflineQueue();
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [processOfflineQueue]);

    const handleCheckout = async ({ setShowMobileCart, setSelectedCustomer }) => {
        if (!user || cart.length === 0) return;

        const isAdmin = userData?.role === 'admin';
        const isOffline = !navigator.onLine;

        // ✅ Clientes sin internet: bloqueamos antes de cualquier spinner
        if (isOffline && !isAdmin) {
            setCheckoutError({
                message: 'Sin conexión a internet.',
                items: cart.map(i => `${i.qty}x ${i.name}`).join(', '),
                total: cartTotal,
                time: new Date().toLocaleTimeString(),
                isOffline: true,
                isAdmin: false
            });
            return;
        }

        // ✅ Admin sin internet: guardamos en localStorage SIN mostrar spinner.
        // La operación es instantánea (solo escribe en RAM/localStorage),
        // no tiene sentido mostrar "procesando por favor espere".
        if (isOffline && isAdmin) {
            const localId = 'offline-' + Date.now();
            const itemsWithCostOffline = cart.map(i => {
                const p = products.find(prod => prod.id === i.id);
                return { id: i.id, name: i.name, qty: Number(i.qty), price: Number(i.price), cost: p ? Number(p.cost || 0) : 0 };
            });
            const offlineSaleData = {
                type: 'sale',
                total: Number(cartTotal),
                items: itemsWithCostOffline,
                date: { seconds: Math.floor(Date.now() / 1000) },
                deliveryType: 'delivery',
                status: 'pending',
                clientInfo: {
                    name: selectedCustomer?.name || 'Anónimo',
                    address: selectedCustomer?.address || '',
                    phone: selectedCustomer?.phone || ''
                },
                clientId: selectedCustomer?.id || 'anonimo',
                clientName: selectedCustomer?.name || 'Anónimo',
                clientRole: selectedCustomer ? 'customer' : 'guest',
                paymentStatus: 'pending',
                fulfillmentStatus: 'pending',
                sellerId: user.uid,
                paymentMethod: paymentMethod
            };
            addToOfflineQueue({ localId, saleData: offlineSaleData, itemsWithCost: itemsWithCostOffline });
            setLastSale({ ...offlineSaleData, id: localId });
            clearCart();
            setSelectedCustomer(null);
            setShowMobileCart(false);
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
            return;
        }

        // ─── Online: activamos spinner y procedemos normalmente ──────────────
        setIsProcessing(true);
        setCheckoutError(null);

        let finalClient = { id: 'anonimo', name: 'Anónimo', role: 'guest', address: '', phone: '' };

        if (isAdmin && selectedCustomer) {
            finalClient = {
                id: selectedCustomer.id,
                name: selectedCustomer.name,
                role: 'customer',
                address: selectedCustomer.address || '',
                phone: selectedCustomer.phone || ''
            };
        } else if (userData?.role === 'client') {
            finalClient = {
                id: user.uid,
                name: userData.name,
                role: 'client',
                address: userData.address || '',
                phone: userData.phone || ''
            };
        }

        const itemsWithCost = cart.map(i => {
            const p = products.find(prod => prod.id === i.id);
            return {
                id: i.id,
                name: i.name,
                qty: Number(i.qty),
                price: Number(i.price),
                cost: p ? Number(p.cost || 0) : 0
            };
        });

        const saleData = {
            type: 'sale',
            total: Number(cartTotal),
            items: itemsWithCost,
            date: serverTimestamp(),
            deliveryType: 'delivery',
            status: 'pending',
            clientInfo: {
                name: finalClient.name,
                address: finalClient.address,
                phone: finalClient.phone
            },
            clientId: finalClient.id,
            clientName: finalClient.name,
            clientRole: finalClient.role,
            paymentStatus: 'pending',
            fulfillmentStatus: 'pending',
            sellerId: user.uid,
            paymentMethod: paymentMethod
        };

        // ─── Online: intento normal con reintentos ────────────────────────────
        const attemptTransaction = async () => {
            const result = await withTimeout(
                createTransaction(saleData, itemsWithCost),
                CHECKOUT_TIMEOUT_MS
            );

            if (saleData.clientRole === 'client') {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000);
                fetch('/api/notify', {
                    method: 'POST',
                    signal: controller.signal,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        transactionId: result.id,
                        clientName: saleData.clientName,
                        total: saleData.total,
                        storeId: appId
                    })
                }).then(() => clearTimeout(timeoutId)).catch(err => {
                    clearTimeout(timeoutId);
                    console.error("Error al enviar notificación:", err);
                });
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
            console.error("Error en checkout (intento 1):", e.message);

            // ✅ Si el primer intento falló (timeout o error de red) y es admin,
            // guardamos offline directamente SIN reintentar — navigator.onLine no es
            // confiable en Android con señal débil, puede decir "online" sin internet real.
            if (isAdmin) {
                setIsProcessing(false);
                const localId = 'offline-' + Date.now();
                addToOfflineQueue({ localId, saleData: { ...saleData, date: { seconds: Math.floor(Date.now() / 1000) } }, itemsWithCost });
                setLastSale({ ...saleData, id: localId });
                clearCart();
                setSelectedCustomer(null);
                setShowMobileCart(false);
                setPendingSync(true);
                setCheckoutError({
                    message: 'Sin conexión real. Pedido guardado localmente.',
                    items: cart.map(i => `${i.qty}x ${i.name}`).join(', '),
                    total: cartTotal,
                    time: new Date().toLocaleTimeString(),
                    isOffline: true,
                    isAdmin: true,
                    isPendingSync: true
                });
                return;
            }

            // Para clientes: un reintento antes de mostrar error
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
