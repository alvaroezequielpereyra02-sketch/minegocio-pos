import { useState, useCallback, useMemo } from 'react';

/**
 * Calcula el precio efectivo de un item según cantidad.
 * Si el producto tiene precio mayorista y se alcanza la cantidad mínima,
 * devuelve el precio mayorista. Si no, devuelve el precio minorista.
 */
const getEffectivePrice = (product, qty) => {
    const hasWholesale = product.wholesalePrice > 0 && product.wholesaleMinQty > 0;
    if (hasWholesale && qty >= product.wholesaleMinQty) {
        return { price: product.wholesalePrice, isWholesale: true };
    }
    return { price: product.price, isWholesale: false };
};

export const useCart = (products = []) => {
    const [cart, setCart] = useState([]);
    const [paymentMethod, setPaymentMethod] = useState('unspecified');

    // Recalcula el precio de un item en el carrito según su cantidad actual
    const recalcPrice = (item) => {
        const source = products.find(p => p.id === item.id) || item;
        const { price, isWholesale } = getEffectivePrice(source, item.qty);
        return { ...item, price, isWholesale };
    };

    // Agregar producto al carrito
    const addToCart = useCallback((product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                const updated = prev.map(item =>
                    item.id === product.id ? { ...item, qty: item.qty + 1 } : item
                );
                return updated.map(item => item.id === product.id ? recalcPrice(item) : item);
            }
            const { price, isWholesale } = getEffectivePrice(product, 1);
            return [...prev, { ...product, qty: 1, price, isWholesale, imageUrl: product.imageUrl }];
        });
    }, [products]);

    // Actualizar cantidad (+1 o -1)
    const updateCartQty = useCallback((id, delta) => {
        setCart(prev =>
            prev.map(item => {
                if (item.id !== id) return item;
                const newQty = item.qty + delta;
                if (newQty <= 0) return null;
                const source = products.find(p => p.id === id) || item;
                const { price, isWholesale } = getEffectivePrice(source, newQty);
                return { ...item, qty: newQty, price, isWholesale };
            }).filter(Boolean)
        );
    }, [products]);

    // Fijar cantidad específica (input manual)
    const setCartItemQty = useCallback((id, newQty) => {
        const qty = parseInt(newQty);
        if (!qty || qty < 1) return;
        setCart(prev => prev.map(item => {
            if (item.id !== id) return item;
            const source = products.find(p => p.id === id) || item;
            const { price, isWholesale } = getEffectivePrice(source, qty);
            return { ...item, qty, price, isWholesale };
        }));
    }, [products]);

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