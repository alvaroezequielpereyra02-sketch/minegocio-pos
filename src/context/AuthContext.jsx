import React, { createContext, useContext } from 'react';
import { useAuth } from '../hooks/useAuth'; // Reutilizamos tu hook existente
import { app } from '../config/firebase';

// 1. Crear el contexto
const AuthContext = createContext();

// 2. Crear el componente proveedor
export const AuthProvider = ({ children }) => {
    // Usamos el hook que ya tenías, pasándole la app de firebase
    const auth = useAuth(app);

    return (
        <AuthContext.Provider value={auth}>
            {children}
        </AuthContext.Provider>
    );
};

// 3. Crear un hook personalizado para usar el contexto fácilmente
export const useAuthContext = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuthContext debe ser usado dentro de un AuthProvider');
    }
    return context;
};