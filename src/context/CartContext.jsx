import React, { createContext, useContext } from 'react';
import { useAuthContext } from './AuthContext';
import { useCart } from '../hooks/useCart';
import { useOffers } from '../hooks/useOffers';
import { useInventoryContext } from './InventoryContext';

// CartContext expone tanto el carrito como las ofertas en un solo contexto,
// porque useCart necesita activeOfferMap para aplicar descuentos en tiempo real
// y CartProvider es el lugar natural donde ambos coexisten.
const CartContext = createContext();

export const CartProvider = ({ children }) => {
    const { products }   = useInventoryContext();
    const { userData }   = useAuthContext();

    // Ofertas: pasa el rol para que useOffers use la query correcta
    // (admins ven todas, clientes solo las activas — coincide con las reglas de Firestore)
    const offersData = useOffers(userData?.role);

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
