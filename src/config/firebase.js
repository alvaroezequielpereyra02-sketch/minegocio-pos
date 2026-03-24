import { initializeApp } from "firebase/app";
import {
    initializeFirestore,
    persistentLocalCache,
    enableNetwork,
} from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getMessaging, isSupported } from "firebase/messaging";

// Todas las credenciales se leen exclusivamente desde variables de entorno.
const firebaseConfig = {
    apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// 🔍 DIAGNÓSTICO: verificar que las credenciales están cargadas
const envCheck = [
    ['VITE_FIREBASE_API_KEY',             import.meta.env.VITE_FIREBASE_API_KEY],
    ['VITE_FIREBASE_AUTH_DOMAIN',         import.meta.env.VITE_FIREBASE_AUTH_DOMAIN],
    ['VITE_FIREBASE_PROJECT_ID',          import.meta.env.VITE_FIREBASE_PROJECT_ID],
    ['VITE_FIREBASE_STORAGE_BUCKET',      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET],
    ['VITE_FIREBASE_MESSAGING_SENDER_ID', import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID],
    ['VITE_FIREBASE_APP_ID',              import.meta.env.VITE_FIREBASE_APP_ID],
    ['VITE_STORE_ID',                     import.meta.env.VITE_STORE_ID],
    ['VITE_FIREBASE_VAPID_KEY',           import.meta.env.VITE_FIREBASE_VAPID_KEY],
];
const missingVars = envCheck.filter(([, v]) => !v).map(([k]) => k);

if (missingVars.length > 0) {
    console.error('❌ [Firebase] Variables de entorno FALTANTES:', missingVars);
    console.error('   → En Vercel: Settings → Environment Variables. En local: revisá tu .env');
} else if (import.meta.env.DEV) {
    // ✅ FIX: logs de diagnóstico solo en modo desarrollo.
    // En producción evitamos exponer el Project ID en DevTools.
    console.log('✅ [Firebase] Credenciales cargadas. Project ID:', import.meta.env.VITE_FIREBASE_PROJECT_ID);
}

export const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
    localCache: persistentLocalCache()
});

// 🔧 FIX: persistentLocalCache arranca en modo offline hasta que algo dispara la conexión.
// enableNetwork() fuerza la reconexión inmediata al cargar la app.
enableNetwork(db)
    .then(() => { if (import.meta.env.DEV) console.log('✅ [Firestore] Red habilitada'); })
    .catch(e => console.error('❌ [Firestore] Error al habilitar red:', e.message));

export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// appId de la tienda (no confundir con el appId de Firebase)
export const appId = import.meta.env.VITE_STORE_ID || 'tienda-principal';

// FCM: solo inicializamos si el navegador lo soporta (no en Safari iOS antiguo)
export const getMessagingInstance = async () => {
    const supported = await isSupported();
    if (!supported) return null;
    return getMessaging(app);
};

export default app;
