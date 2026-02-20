import { useState } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import { appId } from '../config/firebase'; //

/**
 * Encapsula toda la lógica de procesar una venta (checkout).
 */
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

    const handleCheckout = async ({ setShowMobileCart, setSelectedCustomer }) => {
        if (!user || cart.length === 0) return;
        setIsProcessing(true);

        try {
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

            // 1. Crear la transacción en Firestore
            const result = await createTransaction(saleData, itemsWithCost);

            // 2. DISPARAR NOTIFICACIÓN VÍA VERCEL
            // Solo notificamos si es un pedido realizado por un cliente (no venta directa de admin)
            if (saleData.clientRole === 'client') {
                fetch('/api/notify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        transactionId: result.id,
                        clientName: saleData.clientName,
                        total: saleData.total,
                        storeId: appId // ID de la tienda desde firebase.js
                    })
                }).catch(err => console.error("Error al enviar notificación:", err));
            }

            setLastSale(result);
            clearCart();
            setSelectedCustomer(null);
            setShowMobileCart(false);
            setShowCheckoutSuccess(true);
            setTimeout(() => setShowCheckoutSuccess(false), 4000);

        } catch (e) {
            console.error("Error en checkout:", e);
            showNotification("❌ Error al procesar pedido.");
        } finally {
            setIsProcessing(false);
        }
    };

    return { isProcessing, setIsProcessing, lastSale, showCheckoutSuccess, setShowCheckoutSuccess, handleCheckout };
};