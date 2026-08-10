import { useEffect, useCallback, useRef } from 'react';
import { getToken } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getDb, appId, getMessagingInstance } from '../config/firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// ── Colecciones separadas por rol ─────────────────────────────────────────────
// Deben coincidir con las constantes en lib/firebase.js
const ADMIN_TOKENS_COLLECTION = 'fcm_tokens';        // admins → reciben pedidos
const USER_TOKENS_COLLECTION  = 'fcm_tokens_users';  // clientes → reciben ofertas

const TOKEN_REFRESH_DAYS = 30;

const getPlatform = () => {
    const ua = navigator.userAgent.toLowerCase();
    if (/android/.test(ua)) return 'android';
    if (/iphone|ipad|ipod/.test(ua)) return 'ios';
    return 'desktop';
};

export const useNotifications = (user, userData) => {
    const tokenSavedRef = useRef(false);

    // Forzar re-guardado si el rol cambia
    useEffect(() => { tokenSavedRef.current = false; }, [userData?.role]);

    const getTokenCollection = useCallback(() => {
        return userData?.role === 'admin'
            ? ADMIN_TOKENS_COLLECTION
            : USER_TOKENS_COLLECTION;
    }, [userData?.role]);

    const saveToken = useCallback(async (token) => {
        if (!user) return;
        try {
            const db         = await getDb();
            const collection = getTokenCollection();
            await setDoc(doc(db, 'stores', appId, collection, user.uid), {
                token,
                uid:       user.uid,
                role:      userData?.role || 'unknown',
                platform:  getPlatform(),
                updatedAt: serverTimestamp(),
            });
            tokenSavedRef.current = true;
            if (import.meta.env.DEV) {
                console.log(`✅ FCM token guardado en ${collection} (rol: ${userData?.role})`);
            }
        } catch (e) {
            console.error('Error al guardar token FCM:', e);
        }
    }, [user, userData?.role, getTokenCollection]);

    const requestAndSaveToken = useCallback(async () => {
        if (!user) return;
        if (tokenSavedRef.current) return;

        try {
            if (!('Notification' in window)) return;
            if (Notification.permission === 'denied') return;

            let permission = Notification.permission;
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
                serviceWorkerRegistration: registration,
            });
            if (!token) return;

            // Verificar si el token sigue vigente antes de escribir.
            // Si la lectura falla por permisos, guardamos directamente — es mejor
            // escribir un token idéntico que no tener token registrado.
            try {
                const db         = await getDb();
                const collection = getTokenCollection();
                const { getDoc } = await import('firebase/firestore');
                const snap = await getDoc(doc(db, 'stores', appId, collection, user.uid));
                if (snap.exists()) {
                    const data      = snap.data();
                    const lastUpdate = data.updatedAt?.toDate?.() || new Date(0);
                    const daysSince  = (Date.now() - lastUpdate.getTime()) / 86_400_000;
                    const sameToken  = data.token === token;
                    const sameRole   = data.role === userData?.role;
                    if (sameToken && sameRole && daysSince < TOKEN_REFRESH_DAYS) {
                        tokenSavedRef.current = true;
                        return;
                    }
                }
            } catch {
                // permission-denied en lectura: ignorar y guardar igual
            }

            await saveToken(token);

        } catch (e) {
            console.error('❌ Error FCM:', e);
        }
    }, [user, userData?.role, getTokenCollection, saveToken]);

    useEffect(() => {
        if (user) requestAndSaveToken();
    }, [user, requestAndSaveToken]);

    return { requestAndSaveToken };
};
