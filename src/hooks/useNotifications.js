import { useEffect, useCallback, useRef } from 'react';
import { getToken } from 'firebase/messaging';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, appId, getMessagingInstance } from '../config/firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

/**
 * Hook para manejar push notifications reales (funciona con la app cerrada).
 * Flujo:
 *   1. Admin abre la app → se solicita permiso de notificaciones
 *   2. Se obtiene el FCM token del dispositivo
 *   3. El token se guarda en Firestore (stores/{appId}/fcm_tokens/{uid})
 *   4. La Cloud Function lo lee y envía push cuando llega un pedido nuevo
 */
export const useNotifications = (user, userData) => {
    const tokenSavedRef = useRef(false);

    const saveToken = useCallback(async (token) => {
        if (!user || tokenSavedRef.current) return;
        try {
            await setDoc(doc(db, 'stores', appId, 'fcm_tokens', user.uid), {
                token,
                uid: user.uid,
                role: userData?.role || 'unknown',
                updatedAt: serverTimestamp()
            });
            tokenSavedRef.current = true;
        } catch (e) {
            console.error('Error guardando FCM token:', e);
        }
    }, [user, userData?.role]);

    const removeToken = useCallback(async () => {
        if (!user) return;
        try {
            await deleteDoc(doc(db, 'stores', appId, 'fcm_tokens', user.uid));
            tokenSavedRef.current = false;
        } catch (e) {
            console.error('Error eliminando FCM token:', e);
        }
    }, [user]);

    const requestAndSaveToken = useCallback(async () => {
        // Solo pedimos permiso a admins
        if (userData?.role !== 'admin') return;
        if (!('Notification' in window)) return;

        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return;

            const messaging = await getMessagingInstance();
            if (!messaging || !VAPID_KEY) {
                // Fallback: usamos solo el service worker sin FCM si no hay VAPID key
                console.warn('FCM no disponible. Usando SW básico.');
                return;
            }

            const token = await getToken(messaging, { vapidKey: VAPID_KEY });
            if (token) await saveToken(token);
        } catch (e) {
            console.error('Error al obtener FCM token:', e);
        }
    }, [userData?.role, saveToken]);

    // Solicitar permiso y registrar token cuando el admin inicia sesión
    useEffect(() => {
        if (userData?.role === 'admin') {
            requestAndSaveToken();
        }
    }, [userData?.role, requestAndSaveToken]);

    // Limpiar el token cuando el usuario hace logout
    useEffect(() => {
        return () => {
            // Solo limpiar en logout real (user pasa a null)
            if (!user) {
                tokenSavedRef.current = false;
            }
        };
    }, [user]);

    return { requestAndSaveToken, removeToken };
};
