import { useState, useEffect } from 'react';

/**
 * useOnlineStatus
 * Detecta el estado de conexión y muestra una notificación al cambiar.
 * Evita el falso positivo de navigator.onLine en Android.
 */
export const useOnlineStatus = (showNotification) => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handler = () => {
            setIsOnline(navigator.onLine);
            showNotification(
                navigator.onLine
                    ? "🟢 Conexión restaurada"
                    : "🔴 Sin conexión (Modo Offline)"
            );
        };
        window.addEventListener('online',  handler);
        window.addEventListener('offline', handler);
        return () => {
            window.removeEventListener('online',  handler);
            window.removeEventListener('offline', handler);
        };
    }, []);

    return { isOnline };
};
