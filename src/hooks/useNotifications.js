import { useEffect, useCallback, useRef } from 'react';
import { getToken } from 'firebase/messaging';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, appId, getMessagingInstance } from '../config/firebase';

// Esta es la clave pública que identifica tu servidor ante el navegador
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

/**
 * Hook para manejar push notifications reales.
 * Registra el dispositivo del administrador en Firestore para que Vercel sepa a quién notificar.
 */
export const useNotifications = (user, userData) => {
    const tokenSavedRef = useRef(false);

    const saveToken = useCallback(async (token) => {
        if (!user || tokenSavedRef.current) return;
        try {
            // Se guarda en: stores/tienda-principal/fcm_tokens/{uid}
            await setDoc(doc(db, 'stores', appId, 'fcm_tokens', user.uid), {
                token,
                uid: user.uid,
                role: userData?.role || 'unknown',
                updatedAt: serverTimestamp()
            });
            tokenSavedRef.current = true;
            console.log("✅ Token guardado en Firestore para el admin:", user.uid);
        } catch (e) {
            console.error('❌ Error al guardar el FCM token en Firestore:', e);
        }
    }, [user, userData?.role]);

    const removeToken = useCallback(async () => {
        if (!user) return;
        try {
            await deleteDoc(doc(db, 'stores', appId, 'fcm_tokens', user.uid));
            tokenSavedRef.current = false;
            console.log("🗑️ Token eliminado de Firestore (logout).");
        } catch (e) {
            console.error('❌ Error al eliminar el FCM token:', e);
        }
    }, [user]);

    const requestAndSaveToken = useCallback(async () => {
        // 1. Verificación de Rol
        if (userData?.role !== 'admin') {
            console.warn("⚠️ Registro de notificaciones omitido: El usuario no es admin.");
            return;
        }

        if (!('Notification' in window)) {
            console.error("❌ Este navegador no soporta notificaciones de escritorio.");
            return;
        }

        try {
            // 2. Solicitar Permiso
            console.log("🔔 Solicitando permiso de notificaciones...");
            const permission = await Notification.requestPermission();

            if (permission !== 'granted') {
                console.warn("🚫 Permiso de notificaciones denegado por el usuario.");
                return;
            }

            // 3. Obtener Instancia de Messaging
            const messaging = await getMessagingInstance();
            if (!messaging || !VAPID_KEY) {
                console.error("❌ FCM no disponible. Verifica que VITE_FIREBASE_VAPID_KEY esté configurada.");
                return;
            }

            // 4. Generar Token de Dispositivo
            console.log("🔑 Generando token de dispositivo con VAPID Key...");
            const token = await getToken(messaging, { vapidKey: VAPID_KEY });

            if (token) {
                console.log("✨ Token obtenido con éxito:", token);
                await saveToken(token);
            } else {
                console.warn("⚠️ No se pudo obtener el token (getToken devolvió null).");
            }

        } catch (e) {
            console.error('❌ Error crítico al obtener el FCM token:', e);
        }
    }, [userData?.role, saveToken]);

    // Disparar el proceso cuando el administrador inicia sesión o cambia su rol
    useEffect(() => {
        if (userData?.role === 'admin') {
            requestAndSaveToken();
        }
    }, [userData?.role, requestAndSaveToken]);

    // Limpieza al cerrar sesión
    useEffect(() => {
        return () => {
            if (!user) {
                tokenSavedRef.current = false;
            }
        };
    }, [user]);

    return { requestAndSaveToken, removeToken };
};