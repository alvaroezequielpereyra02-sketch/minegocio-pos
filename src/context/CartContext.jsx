import React, { createContext, useContext } from 'react';
import { useCart } from '../hooks/useCart';
import { useOffers } from '../hooks/useOffers';
import { useInventoryContext } from './InventoryContext';

// CartContext expone tanto el carrito como las ofertas en un solo contexto,
// porque useCart necesita activeOfferMap para aplicar descuentos en tiempo real
// y CartProvider es el lugar natural donde ambos coexisten.
const CartContext = createContext();

export const CartProvider = ({ children }) => {
    const { products } = useInventoryContext();

    // Ofertas: genera activeOfferMap (Map<productId, discountEntry>)
    const offersData = useOffers();

    // Carrito: recibe activeOfferMap para aplicar descuentos automáticamente
    const cartData = useCart(products, offersData.activeOfferMap);

    return (
        <CartContext.Provider value={{ ...cartData, ...offersData }}>
            {children}
        </CartContext.Provider>
    );
};

export const useCartContext = () => {
    const context = useContext(CartContext);
    if (!context) throw new Error('useCartContext debe usarse dentro de CartProvider');
    return context;
};
