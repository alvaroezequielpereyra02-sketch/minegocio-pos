import React, { createContext, useContext } from 'react';
import { useInventory } from '../hooks/useInventory';
import { useAuthContext } from './AuthContext';

const InventoryContext = createContext();

export const InventoryProvider = ({ children }) => {
    // 1. Obtenemos el usuario del AuthContext (ya no viene de props)
    const { user, userData } = useAuthContext();

    // 2. Ejecutamos el hook maestro de inventario
    const inventoryData = useInventory(user, userData);

    return (
        <InventoryContext.Provider value={inventoryData}>
            {children}
        </InventoryContext.Provider>
    );
};

export const useInventoryContext = () => {
    const context = useContext(InventoryContext);
    if (!context) {
        throw new Error('useInventoryContext debe ser usado dentro de un InventoryProvider');
    }
    return context;
};