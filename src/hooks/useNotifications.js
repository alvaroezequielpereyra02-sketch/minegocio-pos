import { useEffect, useCallback, useRef } from 'react';
import { getToken } from 'firebase/messaging';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, appId, getMessagingInstance } from '../config/firebase';

// Tu clave VAPID real integrada
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
            console.log("✅ Token guardado en Firestore exitosamente.");
        } catch (e) {
            console.error('❌ Error guardando token en Firestore:', e);
        }
    }, [user, userData?.role]);

    const requestAndSaveToken = useCallback(async () => {
        // Solo admins y navegadores con soporte
        if (userData?.role !== 'admin' || !('Notification' in window)) return;

        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                console.warn("⚠️ Permiso de notificación denegado.");
                return;
            }

            // --- SOLUCIÓN AL ABORTERROR: Esperar activación real ---
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

                // Si el SW no está activo, esperamos a que cambie de estado
                if (!registration.active) {
                    console.log("⏳ Service Worker instalándose... esperando activación.");
                    await new Promise((resolve) => {
                        const sw = registration.installing || registration.waiting;
                        sw?.addEventListener('statechange', (e) => {
                            if (e.target.state === 'activated') resolve();
                        });
                        // Por seguridad, si ya estaba ahí pero no activo
                        setTimeout(resolve, 2000);
                    });
                }
                console.log("🚀 Service Worker detectado como ACTIVO.");
            }

            const messaging = await getMessagingInstance();
            if (!messaging) return;

            // Obtención del token
            const token = await getToken(messaging, { vapidKey: VAPID_KEY });

            if (token) {
                console.log("✨ Token generado:", token);
                await saveToken(token);
            }
        } catch (e) {
            console.error('❌ Error en el proceso de FCM:', e);
        }
    }, [userData?.role, saveToken]);

    useEffect(() => {
        if (userData?.role === 'admin') {
            requestAndSaveToken();
        }
    }, [userData?.role, requestAndSaveToken]);

    return { requestAndSaveToken };
};