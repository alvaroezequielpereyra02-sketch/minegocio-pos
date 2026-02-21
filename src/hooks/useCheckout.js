import { useState } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import { appId } from '../config/firebase';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3000;
const CHECKOUT_TIMEOUT_MS = 12000; // 12 segundos máximo por intento

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Envuelve una promesa con un timeout
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

    const handleCheckout = async ({ setShowMobileCart, setSelectedCustomer }) => {
        if (!user || cart.length === 0) return;
        setIsProcessing(true);
        setCheckoutError(null);

        // ✅ saleData e itemsWithCost se definen ANTES del try-catch
        // para que sean accesibles en los reintentos del catch
        let finalClient = { id: 'anonimo', name: 'Anónimo', role: 'guest', address: '', phone: '' };

        if (userData?.role === 'admin' && selectedCustomer) {
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

        const attemptTransaction = async () => {
            // ✅ Timeout por intento para no quedar colgado indefinidamente
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

            // ✅ Si es timeout o error de red, reintentamos
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
                // ✅ Si era offline, mensaje específico. Si era otro error, mensaje genérico.
                const isOffline = !navigator.onLine;
                setCheckoutError({
                    message: isOffline
                        ? "Sin conexión a internet. El pedido no pudo enviarse."
                        : "No se pudo registrar el pedido.",
                    items: cart.map(i => `${i.qty}x ${i.name}`).join(', '),
                    total: cartTotal,
                    time: new Date().toLocaleTimeString(),
                    isOffline
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
        handleCheckout
    };
};
