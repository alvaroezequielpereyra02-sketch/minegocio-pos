import { useEffect, useCallback, useRef } from 'react';
import { getToken } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, appId, getMessagingInstance } from '../config/firebase';

const VAPID_KEY = "BINx8NukBcTbTC9LeWI5ePYTbtYVZ60OmD_BB75r1DmJ5Eeq9fKg3Cs885rAHPNYcy1JfzGKXX7SogeIwS_90TM";

// Detecta si es móvil o desktop
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
        if (!user || tokenSavedRef.current) return;
        try {
            await setDoc(doc(db, 'stores', appId, 'fcm_tokens', user.uid), {
                token,
                uid: user.uid,
                role: userData?.role || 'unknown',
                platform: getPlatform(), // ✅ guardamos la plataforma
                updatedAt: serverTimestamp()
            });
            tokenSavedRef.current = true;
            console.log("✅ Token guardado en Firestore. Plataforma:", getPlatform());
        } catch (e) { console.error('Error al guardar token:', e); }
    }, [user, userData?.role]);

    const requestAndSaveToken = useCallback(async () => {
        if (userData?.role !== 'admin') return;

        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return;

            if (!('serviceWorker' in navigator)) {
                console.warn('Service Workers no soportados en este navegador.');
                return;
            }

            await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
            const registration = await navigator.serviceWorker.ready;
            console.log("🚀 Service Worker ACTIVO:", registration.scope);

            const messaging = await getMessagingInstance();
            const token = await getToken(messaging, {
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: registration
            });

            if (token) {
                console.log("🔑 Token FCM obtenido.");
                await saveToken(token);
            } else {
                console.warn("⚠️ No se obtuvo token. Verificá permisos y configuración VAPID.");
            }
        } catch (e) {
            console.error('❌ Error FCM:', e);
        }
    }, [userData?.role, saveToken]);

    useEffect(() => {
        if (userData?.role === 'admin') requestAndSaveToken();
    }, [userData?.role, requestAndSaveToken]);

    return { requestAndSaveToken };
};
