import { useEffect, useCallback, useRef } from 'react';
import { getToken } from 'firebase/messaging';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, appId, getMessagingInstance } from '../config/firebase'; //

// --- CAMBIO TEMPORAL PARA DEPUREACIÓN ---
// Reemplaza el texto entre comillas con tu Public Key de Firebase Console
const VAPID_KEY = "BINx8NukBcTbTC9LeWI5ePYTbtYVZ60OmD_BB75r1DmJ5Eeq9fKg3Cs885rAHPNYcy1JfzGKXX7SogeIwS_90TM";
// ----------------------------------------

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
        console.log("🔍 Iniciando registro de notificaciones. Rol actual:", userData?.role);

        if (userData?.role !== 'admin') {
            console.warn("⚠️ Solo los administradores pueden registrar tokens.");
            return;
        }

        if (!('Notification' in window)) {
            console.error("❌ Este navegador no soporta notificaciones.");
            return;
        }

        try {
            const permission = await Notification.requestPermission();
            console.log("🔔 Permiso de notificación:", permission);
            if (permission !== 'granted') return;

            const messaging = await getMessagingInstance();

            if (!messaging || VAPID_KEY === "TU_CLAVE_VAPID_AQUI_ENTRE_COMILLAS") {
                console.error("❌ Falta la VAPID_KEY manual en el archivo useNotifications.js");
                return;
            }

            console.log("🔑 Solicitando token a Firebase con la clave manual...");
            const token = await getToken(messaging, { vapidKey: VAPID_KEY });

            if (token) {
                console.log("✨ Token generado con éxito:", token);
                await saveToken(token);
            } else {
                console.warn("⚠️ No se generó ningún token. Revisa tu clave en Firebase Console.");
            }
        } catch (e) {
            console.error('❌ Error crítico al obtener el FCM token:', e);
        }
    }, [userData?.role, saveToken]);

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