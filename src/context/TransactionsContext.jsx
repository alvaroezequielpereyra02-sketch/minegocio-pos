import React, { createContext, useContext, useState } from 'react';
import { useTransactions } from '../hooks/useTransactions';
import { useAuthContext } from './AuthContext';
import { useInventoryContext } from './InventoryContext';

const TransactionsContext = createContext();

export const TransactionsProvider = ({ children }) => {
    const { user, userData } = useAuthContext();
    const { products, expenses, categories } = useInventoryContext();

    // 🟢 ESTADO GLOBAL DE TIEMPO: Ahora el contexto controla el rango
    const [dateRange, setDateRange] = useState('week');

    // Pasamos el dateRange al hook para que el balance se recalcule
    const transactionsData = useTransactions(user, userData, products, expenses, categories, dateRange);

    // 🟢 VALORES COMPARTIDOS: Incluimos dateRange y setDateRange en el Provider
    const value = {
        ...transactionsData,
        dateRange,
        setDateRange
    };

    return (
        <TransactionsContext.Provider value={value}>
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