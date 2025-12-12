import React, { createContext, useContext } from 'react';
import { useTransactions } from '../hooks/useTransactions';
import { useAuthContext } from './AuthContext';
import { useInventoryContext } from './InventoryContext';

const TransactionsContext = createContext();

export const TransactionsProvider = ({ children }) => {
    const { user, userData } = useAuthContext();
    // Necesitamos productos, gastos y categorías para el hook de transacciones
    const { products, expenses, categories } = useInventoryContext();

    // Puedes definir el rango por defecto aquí o manejarlo con un estado global si prefieres
    // Por ahora lo dejamos fijo o manejado internamente si el hook lo permite
    const dateRange = 'week';

    const transactionsData = useTransactions(user, userData, products, expenses, categories, dateRange);

    return (
        <TransactionsContext.Provider value={transactionsData}>
            {children}
        </TransactionsContext.Provider>
    );
};

export const useTransactionsContext = () => {
    const context = useContext(TransactionsContext);
    if (!context) {
        throw new Error('useTransactionsContext debe ser usado dentro de un TransactionsProvider');
    }
    return context;
};