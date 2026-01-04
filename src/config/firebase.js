import { initializeApp } from "firebase/app";
import { getFirestore, enableMultiTabIndexedDbPersistence } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// 1. EXPORTACIONES INMEDIATAS (Evita el ReferenceError 'k')
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
export const appId = 'tienda-principal';

// 2. ACTIVACIÓN OFFLINE EN SEGUNDO PLANO
// No usamos 'await' ni bloqueamos la ejecución para que React cargue rápido
if (typeof window !== "undefined") {
    enableMultiTabIndexedDbPersistence(db).catch((err) => {
        if (err.code === 'failed-precondition') {
            // Esto pasa si tienes otra pestaña abierta. 
            // Cierra las demás pestañas para que el offline sea rápido.
            console.warn("Modo Offline limitado: otra pestaña está activa.");
        }
    });
}

export default app;