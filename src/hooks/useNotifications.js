import { useEffect, useCallback, useRef } from 'react';
import { getToken } from 'firebase/messaging';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, appId, getMessagingInstance } from '../config/firebase'; //

// Esta variable debe estar definida en el panel de Vercel (o archivo .env) con prefijo VITE_
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

/**
 * Hook para manejar la suscripción a notificaciones push.
 * Registra el token del dispositivo en la colección fcm_tokens de la tienda.
 */
export const useNotifications = (user, userData) => {
    const tokenSavedRef = useRef(false);

    const saveToken = useCallback(async (token) => {
        if (!user || tokenSavedRef.current) return;
        try {
            // Guarda el token en: stores/tienda-principal/fcm_tokens/{uid}
            await setDoc(doc(db, 'stores', appId, 'fcm_tokens', user.uid), {
                token,
                uid: user.uid,
                role: userData?.role || 'unknown',
                updatedAt: serverTimestamp()
            });
            tokenSavedRef.current = true;
            console.log("✅ Token guardado con éxito en Firestore para el admin.");
        } catch (e) {
            console.error('❌ Error guardando FCM token en Firestore:', e);
        }
    }, [user, userData?.role]);

    const removeToken = useCallback(async () => {
        if (!user) return;
        try {
            await deleteDoc(doc(db, 'stores', appId, 'fcm_tokens', user.uid));
            tokenSavedRef.current = false;
            console.log("🗑️ Token eliminado (logout).");
        } catch (e) {
            console.error('❌ Error eliminando FCM token:', e);
        }
    }, [user]);

    const requestAndSaveToken = useCallback(async () => {
        // Log 1: Verificar si el usuario es admin
        console.log("🔍 Iniciando registro de notificaciones. Rol actual:", userData?.role);

        if (userData?.role !== 'admin') {
            console.warn("⚠️ Solo los administradores pueden registrar tokens de notificación.");
            return;
        }

        if (!('Notification' in window)) {
            console.error("❌ Este navegador no soporta notificaciones.");
            return;
        }

        try {
            // Log 2: Verificar permiso
            const permission = await Notification.requestPermission();
            console.log("🔔 Permiso de notificación:", permission);
            if (permission !== 'granted') return;

            const messaging = await getMessagingInstance(); //

            // Log 3: Verificar VAPID KEY y Messaging
            if (!messaging || !VAPID_KEY) {
                console.error("❌ FCM no disponible. Verifica que VITE_FIREBASE_VAPID_KEY esté configurada correctamente en Vercel.");
                console.log("Valor de VAPID_KEY detectado:", VAPID_KEY);
                return;
            }

            console.log("🔑 Solicitando token a Firebase con VAPID Key...");
            const token = await getToken(messaging, { vapidKey: VAPID_KEY });

            if (token) {
                console.log("✨ Token generado con éxito:", token);
                await saveToken(token);
            } else {
                console.warn("⚠️ No se generó ningún token. Revisa la configuración en Firebase Console.");
            }
        } catch (e) {
            console.error('❌ Error crítico al obtener el FCM token:', e);
        }
    }, [userData?.role, saveToken]);

    // Solicitar permiso automáticamente cuando el admin inicia sesión
    useEffect(() => {
        if (userData?.role === 'admin') {
            requestAndSaveToken();
        }
    }, [userData?.role, requestAndSaveToken]);

    useEffect(() => {
        return () => {
            if (!user) {
                tokenSavedRef.current = false;
            }
        };
    }, [user]);

    return { requestAndSaveToken, removeToken };
};