import { useState } from 'react';

/**
 * useModals
 * Centraliza el estado de apertura/cierre de todos los modales de la app.
 */
export const useModals = () => {
    const [modals, setModals] = useState({
        product:     false,
        category:    false,
        customer:    false,
        transaction: false,
        store:       false,
        stock:       false,
        expense:     false,
        logout:      false,
        invitation:  false,
        faulty:      false,
    });

    const toggleModal = (name, value) =>
        setModals(prev => ({ ...prev, [name]: value }));

    return { modals, toggleModal };
};
