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
enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        console.warn("Persistencia falló: múltiples pestañas abiertas");
    } else if (err.code === 'unimplemented') {
        console.warn("El navegador no soporta persistencia offline");
    }
});
// 1. Inicializamos 'app' y la exportamos COMO CONSTANTE (para import { app })
export const app = initializeApp(firebaseConfig);

// 2. Inicializamos y exportamos los demás servicios
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();


// 3. Exportamos el ID de la tienda
export const appId = 'tienda-principal';

// 4. También exportamos 'app' por defecto (por si algún archivo usa import app from...)
export default app;