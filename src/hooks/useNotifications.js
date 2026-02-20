import { useEffect, useCallback, useRef } from 'react';
import { getToken } from 'firebase/messaging';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, appId, getMessagingInstance } from '../config/firebase';

// Reemplaza esto con tu Public VAPID Key de Firebase
const VAPID_KEY = "TU_CLAVE_VAPID_REAL_AQUI";

/**
 * Hook completo para notificaciones con corrección de Service Worker.
 */
export const useNotifications = (user, userData) => {
    const tokenSavedRef = useRef(false);

    // Guarda el token en Firestore
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
            console.log("✅ Token guardado en Firestore.");
        } catch (e) {
            console.error('Error guardando FCM token:', e);
        }
    }, [user, userData?.role]);

    // Elimina el token al cerrar sesión
    const removeToken = useCallback(async () => {
        if (!user) return;
        try {
            await deleteDoc(doc(db, 'stores', appId, 'fcm_tokens', user.uid));
            tokenSavedRef.current = false;
            console.log("🗑️ Token eliminado.");
        } catch (e) {
            console.error('Error eliminando FCM token:', e);
        }
    }, [user]);

    const requestAndSaveToken = useCallback(async () => {
        if (userData?.role !== 'admin') return;
        if (!('Notification' in window)) return;

        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return;

            // --- CORRECCIÓN CRÍTICA: Esperar al Service Worker ---
            if ('serviceWorker' in navigator) {
                await navigator.serviceWorker.ready;
                console.log("👷 Service Worker listo para suscribirse.");
            }

            const messaging = await getMessagingInstance();
            if (!messaging || !VAPID_KEY) {
                console.error("FCM o VAPID_KEY no disponibles.");
                return;
            }

            const token = await getToken(messaging, { vapidKey: VAPID_KEY });
            if (token) await saveToken(token);
        } catch (e) {
            console.error('Error al obtener FCM token:', e);
        }
    }, [userData?.role, saveToken]);

    // Registro automático para admins
    useEffect(() => {
        if (userData?.role === 'admin') {
            requestAndSaveToken();
        }
    }, [userData?.role, requestAndSaveToken]);

    // Limpieza en logout
    useEffect(() => {
        return () => {
            if (!user) {
                tokenSavedRef.current = false;
            }
        };
    }, [user]);

    return { requestAndSaveToken, removeToken };
};