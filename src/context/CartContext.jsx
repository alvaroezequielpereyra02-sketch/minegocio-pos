import React, { createContext, useContext } from 'react';
import { useCart } from '../hooks/useCart';
import { useInventoryContext } from './InventoryContext';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
    // 1. Obtenemos los productos del contexto de inventario
    const { products } = useInventoryContext();

    // 2. Inicializamos el hook del carrito pasándole los productos (para calcular costos)
    const cartData = useCart(products);

    return (
        <CartContext.Provider value={cartData}>
            {children}
        </CartContext.Provider>
    );
};

export const useCartContext = () => {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error('useCartContext debe ser usado dentro de un CartProvider');
    }
    return context;
};