import { useEffect, useCallback, useRef } from 'react';
import { getToken } from 'firebase/messaging';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getDb, appId, getMessagingInstance } from '../config/firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// Token FCM expira aproximadamente cada 60 días — refrescamos si pasó más de 30 días
const TOKEN_REFRESH_DAYS = 30;

const getPlatform = () => {
    const ua = navigator.userAgent.toLowerCase();
    if (/android/.test(ua)) return 'android';
    if (/iphone|ipad|ipod/.test(ua)) return 'ios';
    return 'desktop';
};

export const useNotifications = (user, userData) => {
    const tokenSavedRef = useRef(false);

    // Si el rol cambia, forzar re-guardado del token con rol actualizado
    useEffect(() => {
        tokenSavedRef.current = false;
    }, [userData?.role]);

    const saveToken = useCallback(async (token) => {
        if (!user) return;
        try {
            const db = await getDb();
            await setDoc(doc(db, 'stores', appId, 'fcm_tokens', user.uid), {
                token,
                uid:       user.uid,
                role:      userData?.role || 'unknown',
                platform:  getPlatform(),
                updatedAt: serverTimestamp()
            });
            tokenSavedRef.current = true;
            if (import.meta.env.DEV) console.log('✅ FCM token guardado correctamente.');
        } catch (e) { console.error('Error al guardar token:', e); }
    }, [user, userData?.role]);

    const requestAndSaveToken = useCallback(async () => {
        // FIX: antes solo procesaba admins. Ahora cualquier usuario autenticado
        // puede recibir notificaciones (ofertas para clientes, pedidos para admins).
        // La distinción de QUÉ notificaciones recibe cada uno la maneja el servidor
        // en notify.js (solo admins) y notify-offer.js (todos).
        if (!user) return;

        try {
            if (!('Notification' in window)) return;

            // Para clientes: pedir permiso silenciosamente sin interrumpir el flujo.
            // Si ya denegaron, no volver a preguntar.
            const currentPermission = Notification.permission;
            if (currentPermission === 'denied') return;

            // Solo pedimos permiso explícitamente si no está concedido.
            // En iOS PWA el prompt es obligatorio y bloqueante — lo hacemos igual para todos.
            let permission = currentPermission;
            if (permission !== 'granted') {
                permission = await Notification.requestPermission();
            }
            if (permission !== 'granted') return;

            if (!('serviceWorker' in navigator)) return;

            await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
            const registration = await navigator.serviceWorker.ready;

            const messaging = await getMessagingInstance();
            if (!messaging) return;

            const token = await getToken(messaging, {
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: registration
            });

            if (!token) return;

            if (tokenSavedRef.current) return;

            // Verificar si el token cambió o expiró antes de escribir en Firestore
            const db = await getDb();
            const existingDoc = await getDoc(doc(db, 'stores', appId, 'fcm_tokens', user.uid));
            if (existingDoc.exists()) {
                const existing      = existingDoc.data();
                const lastUpdate    = existing.updatedAt?.toDate?.() || new Date(0);
                const daysSince     = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
                const tokenChanged  = existing.token !== token;
                const roleChanged   = existing.role !== userData?.role;

                if (!tokenChanged && daysSince < TOKEN_REFRESH_DAYS && !roleChanged) {
                    tokenSavedRef.current = true;
                    return;
                }
            }

            await saveToken(token);
        } catch (e) {
            console.error('❌ Error FCM:', e);
        }
    }, [user, userData?.role, saveToken]);

    // Ejecutar al autenticarse (cualquier rol)
    useEffect(() => {
        if (user) requestAndSaveToken();
    }, [user, requestAndSaveToken]);

    return { requestAndSaveToken };
};
