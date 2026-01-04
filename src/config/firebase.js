import { initializeApp } from "firebase/app";
import { getFirestore, enableMultiTabIndexedDbPersistence } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getStorage } from "firebase/storage";

// 1. Constantes simples primero (Evita que hooks fallen al cargar)
const appId = 'tienda-principal';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// 2. Inicialización de servicios (sin exportar todavía)
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// 3. Activar persistencia offline (con manejo de errores silencioso)
// Esto soluciona la lentitud en el facturado sin internet
enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        console.warn("Persistencia: Múltiples pestañas abiertas.");
    } else if (err.code === 'unimplemented') {
        console.warn("Persistencia: El navegador no la soporta.");
    }
});

// 4. Exportar TODO al final (Garantiza que las variables estén listas)
// Esto soluciona el error "Cannot access 'k' before initialization"
export { app, db, auth, storage, googleProvider, appId };

// Por compatibilidad con algunos imports antiguos
export default app;