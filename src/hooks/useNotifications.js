import { useEffect, useCallback, useRef } from 'react';
import { getToken } from 'firebase/messaging';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db, appId, getMessagingInstance } from '../config/firebase';

const VAPID_KEY = "BINx8NukBcTbTC9LeWI5ePYTbtYVZ60OmD_BB75r1DmJ5Eeq9fKg3Cs885rAHPNYcy1JfzGKXX7SogeIwS_90TM";

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
            await setDoc(doc(db, 'stores', appId, 'fcm_tokens', user.uid), {
                token,
                uid: user.uid,
                role: userData?.role || 'unknown',
                platform: getPlatform(),
                updatedAt: serverTimestamp()
            });
            tokenSavedRef.current = true;
            console.log("✅ Token FCM guardado. Plataforma:", getPlatform());
        } catch (e) { console.error('Error al guardar token:', e); }
    }, [user, userData?.role]);

    const requestAndSaveToken = useCallback(async () => {
        if (userData?.role !== 'admin') return;

        try {
            const permission = await Notification.requestPermission();
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

            if (!token) {
                console.warn("⚠️ No se obtuvo token FCM.");
                return;
            }

            // ✅ Verificamos si el token guardado es diferente al actual o si expiró
            // Esto cubre: token rotado por FCM, primer uso en este dispositivo,
            // y el caso donde un admin no recibe notificaciones por token vencido
            if (tokenSavedRef.current) return;

            const existingDoc = await getDoc(doc(db, 'stores', appId, 'fcm_tokens', user.uid));
            if (existingDoc.exists()) {
                const existing = existingDoc.data();
                const lastUpdate = existing.updatedAt?.toDate?.() || new Date(0);
                const daysSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
                const tokenChanged = existing.token !== token;

                // Guardamos si: token cambió, o pasaron más de 30 días, o el rol cambió
                if (!tokenChanged && daysSinceUpdate < TOKEN_REFRESH_DAYS && existing.role === userData?.role) {
                    console.log("✅ Token FCM vigente, no requiere actualización.");
                    tokenSavedRef.current = true;
                    return;
                }
            }

            await saveToken(token);
        } catch (e) {
            console.error('❌ Error FCM:', e);
        }
    }, [user, userData?.role, saveToken]);

    useEffect(() => {
        if (userData?.role === 'admin') requestAndSaveToken();
    }, [userData?.role, requestAndSaveToken]);

    return { requestAndSaveToken };
};
