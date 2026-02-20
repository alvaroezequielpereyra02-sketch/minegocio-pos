import { useEffect, useCallback, useRef } from 'react';
import { getToken } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, appId, getMessagingInstance } from '../config/firebase';

const VAPID_KEY = "BINx8NukBcTbTC9LeWI5ePYTbtYVZ60OmD_BB75r1DmJ5Eeq9fKg3Cs885rAHPNYcy1JfzGKXX7SogeIwS_90TM";

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
            console.log("✅ Token guardado en Firestore.");
        } catch (e) { console.error('Error al guardar token:', e); }
    }, [user, userData?.role]);

    const requestAndSaveToken = useCallback(async () => {
        if (userData?.role !== 'admin') return;

        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return;

            if ('serviceWorker' in navigator) {
                // Registro explícito
                const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

                // 🔄 ESPERA ACTIVA: No avanzar hasta que esté 'activated'
                while (!reg.active || reg.active.state !== 'activated') {
                    console.log("⏳ Esperando activación del Service Worker...");
                    await new Promise(res => setTimeout(res, 500));
                }
                console.log("🚀 Service Worker ACTIVO.");
            }

            const messaging = await getMessagingInstance();
            const token = await getToken(messaging, { vapidKey: VAPID_KEY });

            if (token) await saveToken(token);
        } catch (e) {
            console.error('❌ Error FCM:', e);
        }
    }, [userData?.role, saveToken]);

    useEffect(() => {
        if (userData?.role === 'admin') requestAndSaveToken();
    }, [userData?.role, requestAndSaveToken]);

    return { requestAndSaveToken };
};