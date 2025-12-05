import { useState, useCallback, useMemo } from 'react';

export const useCart = (products = []) => {
    const [cart, setCart] = useState([]);
    const [paymentMethod, setPaymentMethod] = useState('unspecified');

    // Agregar producto al carrito
    const addToCart = useCallback((product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item =>
                    item.id === product.id ? { ...item, qty: item.qty + 1 } : item
                );
            }
            // Aseguramos que la imagen se pase correctamente
            return [...prev, { ...product, qty: 1, imageUrl: product.imageUrl }];
        });
    }, []);

    // Actualizar cantidad (+1 o -1)
    const updateCartQty = useCallback((id, delta) => {
        setCart(prev =>
            prev.map(item => item.id === id ? { ...item, qty: item.qty + delta } : item)
                .filter(i => i.qty > 0 || i.id !== id) // Eliminar si llega a 0
        );
    }, []);

    // Fijar cantidad específica (input manual)
    const setCartItemQty = useCallback((id, newQty) => {
        const qty = parseInt(newQty);
        if (!qty || qty < 1) return;
        setCart(prev => prev.map(item => item.id === id ? { ...item, qty: qty } : item));
    }, []);

    // Eliminar item
    const removeFromCart = useCallback((id) => {
        setCart(prev => prev.filter(item => item.id !== id));
    }, []);

    // Limpiar carrito (ej: después de cobrar)
    const clearCart = useCallback(() => {
        setCart([]);
        setPaymentMethod('unspecified');
    }, []);

    // Calcular total (Memoizado para no recalcular si el carrito no cambia)
    const cartTotal = useMemo(() => {
        return cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    }, [cart]);

    // Preparar items para guardar en Firebase (con costo original)
    const getItemsForCheckout = useCallback(() => {
        return cart.map(i => {
            // Buscamos el producto original para obtener el costo actualizado si existe
            const originalProduct = products.find(p => p.id === i.id);
            return {
                ...i,
                cost: originalProduct ? (originalProduct.cost || 0) : 0
            };
        });
    }, [cart, products]);

    return {
        cart,
        addToCart,
        updateCartQty,
        setCartItemQty,
        removeFromCart,
        clearCart,
        cartTotal,
        paymentMethod,
        setPaymentMethod,
        getItemsForCheckout
    };
};