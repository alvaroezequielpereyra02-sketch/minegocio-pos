import { initializeApp } from "firebase/app";
import {
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager
} from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
    apiKey: self.VITE_FIREBASE_API_KEY || 'AIzaSyCo69kQNCYjROXTKlu9SotNuy-QeKdWXYM',
    authDomain: self.VITE_FIREBASE_AUTH_DOMAIN || 'minegocio-pos-e35bf.firebaseapp.com',
    projectId: self.VITE_FIREBASE_PROJECT_ID || 'minegocio-pos-e35bf',
    storageBucket: self.VITE_FIREBASE_STORAGE_BUCKET || 'minegocio-pos-e35bf.firebasestorage.app',
    messagingSenderId: self.VITE_FIREBASE_MESSAGING_SENDER_ID || '613903188094',
    appId: self.VITE_FIREBASE_APP_ID || '613903188094:web:2ed15b6fb6ff5be6fd582f'
};

export const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});

export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// appId de la tienda: configurable por variable de entorno, con fallback
export const appId = import.meta.env.VITE_STORE_ID || 'tienda-principal';

// FCM: solo inicializamos si el navegador lo soporta (no en Safari iOS antiguo)
export const getMessagingInstance = async () => {
    const supported = await isSupported();
    if (!supported) return null;
    return getMessaging(app);
};

export default app;
