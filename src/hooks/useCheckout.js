/**
 * useCheckout — solo maneja el cobro. Sin lógica de sincronización.
 * La sync vive en useSyncManager (App.jsx).
 */
import { useState } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import { appId } from '../config/firebase';
import { addToOfflineQueue, checkRealInternet } from './useSyncManager';

export const useCheckout = ({
    user, userData,
    cart, products, cartTotal,
    paymentMethod, selectedCustomer,
    createTransaction, clearCart,
    onOfflineSaved   // callback → useSyncManager.setPendingCount(n+1)
}) => {
    const [isProcessing, setIsProcessing]               = useState(false);
    const [lastSale, setLastSale]                       = useState(null);
    const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(false);
    const [checkoutError, setCheckoutError]             = useState(null);

    const buildPayload = () => {
        const itemsWithCost = cart.map(i => {
            const p = products.find(x => x.id === i.id);
            return { id: i.id, name: i.name, qty: Number(i.qty), price: Number(i.price), cost: p ? Number(p.cost || 0) : 0 };
        });
        const client = selectedCustomer
            ? { id: selectedCustomer.id, name: selectedCustomer.name, role: 'customer', address: selectedCustomer.address || '', phone: selectedCustomer.phone || '' }
            : userData?.role === 'client'
                ? { id: user.uid, name: userData.name, role: 'client', address: userData.address || '', phone: userData.phone || '' }
                : { id: 'anonimo', name: 'Anónimo', role: 'guest', address: '', phone: '' };
        return { itemsWithCost, client };
    };

    const saveOffline = ({ itemsWithCost, client, setShowMobileCart, setSelectedCustomer }) => {
        const localId = 'offline-' + Date.now();
        addToOfflineQueue({
            localId,
            itemsWithCost,
            saleData: {
                type: 'sale', total: Number(cartTotal), items: itemsWithCost,
                date: { seconds: Math.floor(Date.now() / 1000) },
                deliveryType: 'delivery', status: 'pending',
                clientInfo: { name: client.name, address: client.address, phone: client.phone },
                clientId: client.id, clientName: client.name, clientRole: client.role,
                paymentStatus: 'pending', fulfillmentStatus: 'pending',
                sellerId: user.uid, paymentMethod
            }
        });

        onOfflineSaved?.();  // notifica a App.jsx
        setLastSale({ id: localId });
        clearCart();
        setSelectedCustomer?.(null);
        setShowMobileCart?.(false);
        setCheckoutError({
            isPendingSync: true, isOffline: true,
            items: cart.map(i => `${i.qty}x ${i.name}`).join(', '),
            total: cartTotal, time: new Date().toLocaleTimeString()
        });
    };

    const handleCheckout = async ({ setShowMobileCart, setSelectedCustomer }) => {
        if (!user || cart.length === 0) return;

        const isAdmin = userData?.role === 'admin';
        setCheckoutError(null);
        const { itemsWithCost, client } = buildPayload();

        // PASO 1 — Ping 1.5s. Detecta la realidad en Android con WiFi mentiroso.
        const online = await checkRealInternet();

        if (!online) {
            if (isAdmin) {
                saveOffline({ itemsWithCost, client, setShowMobileCart, setSelectedCustomer });
            } else {
                setCheckoutError({
                    isPendingSync: false, isOffline: true,
                    items: cart.map(i => `${i.qty}x ${i.name}`).join(', '),
                    total: cartTotal, time: new Date().toLocaleTimeString()
                });
            }
            return; // sin spinner, sin espera
        }

        // PASO 2 — Hay internet real: spinner + intento a Firestore
        setIsProcessing(true);
        const saleData = {
            type: 'sale', total: Number(cartTotal), items: itemsWithCost,
            date: serverTimestamp(), deliveryType: 'delivery', status: 'pending',
            clientInfo: { name: client.name, address: client.address, phone: client.phone },
            clientId: client.id, clientName: client.name, clientRole: client.role,
            paymentStatus: 'pending', fulfillmentStatus: 'pending',
            sellerId: user.uid, paymentMethod
        };

        try {
            const result = await Promise.race([
                createTransaction(saleData, itemsWithCost),
                new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), 8000))
            ]);

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
            console.error('[Checkout] fallo online:', e.message);
            if (isAdmin) {
                // Falló en medio del intento (señal débil tardía) → offline
                setIsProcessing(false);
                saveOffline({ itemsWithCost, client, setShowMobileCart, setSelectedCustomer });
                return;
            }
            setCheckoutError({
                isPendingSync: false, isOffline: false,
                items: cart.map(i => `${i.qty}x ${i.name}`).join(', '),
                total: cartTotal, time: new Date().toLocaleTimeString()
            });
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
