import { useState, useEffect } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import { appId } from '../config/firebase';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3000;
const CHECKOUT_TIMEOUT_MS = 12000;

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
    // ✅ Pedidos admin guardados offline pendientes de sincronizar
    const [pendingSync, setPendingSync] = useState(false);

    // ✅ Cuando el admin vuelve a tener internet, mostramos aviso de sincronización
    // Firestore sincroniza automáticamente con persistentLocalCache, solo avisamos
    useEffect(() => {
        if (!pendingSync) return;
        const handleOnline = () => {
            showNotification('🔄 Conexión restaurada — sincronizando pedidos...');
            // Damos 4s para que Firestore sincronice antes de confirmar
            setTimeout(() => {
                showNotification('✅ Pedidos sincronizados con el servidor.');
                setPendingSync(false);
            }, 4000);
        };
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [pendingSync, showNotification]);

    const handleCheckout = async ({ setShowMobileCart, setSelectedCustomer }) => {
        if (!user || cart.length === 0) return;

        const isAdmin = userData?.role === 'admin';
        const isOffline = !navigator.onLine;

        // ✅ Clientes no pueden hacer pedidos offline — riesgo de pedido incompleto
        // Admins sí pueden: la escritura se encola en Firestore y se sincroniza al volver
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

        // ✅ Admin offline: encolamos en Firestore directamente sin timeout ni reintentos
        // persistentLocalCache sincroniza automáticamente cuando vuelve la conexión
        if (isOffline && isAdmin) {
            try {
                await createTransaction(saleData, itemsWithCost);
                setLastSale({ ...saleData, id: 'offline-pending' });
                clearCart();
                setSelectedCustomer(null);
                setShowMobileCart(false);
                setPendingSync(true);
                // Notificación especial que no desaparece sola — ver App.jsx
                setCheckoutError({
                    message: 'Pedido guardado sin conexión.',
                    items: cart.map(i => `${i.qty}x ${i.name}`).join(', '),
                    total: cartTotal,
                    time: new Date().toLocaleTimeString(),
                    isOffline: true,
                    isAdmin: true,
                    isPendingSync: true
                });
            } catch (e) {
                console.error("Error al guardar offline:", e);
                showNotification("❌ No se pudo guardar el pedido offline.");
            } finally {
                setIsProcessing(false);
            }
            return;
        }

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

            let success = false;
            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                try {
                    showNotification(`⏳ Reintentando pedido (${attempt}/${MAX_RETRIES})...`);
                    await sleep(RETRY_DELAY_MS);
                    if (!navigator.onLine) throw new Error('OFFLINE');

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
                    message: !navigator.onLine
                        ? 'Sin conexión. El pedido no se envió.'
                        : 'No se pudo registrar el pedido.',
                    items: cart.map(i => `${i.qty}x ${i.name}`).join(', '),
                    total: cartTotal,
                    time: new Date().toLocaleTimeString(),
                    isOffline: !navigator.onLine,
                    isAdmin,
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
