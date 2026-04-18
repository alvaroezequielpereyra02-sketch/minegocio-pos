import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// ─────────────────────────────────────────────────────────────────────────────
// CORE — se carga en el bundle inicial (solo auth, sin Firestore ni Messaging)
// ─────────────────────────────────────────────────────────────────────────────
const firebaseConfig = {
    apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const missingVars = [
    ['VITE_FIREBASE_API_KEY',             import.meta.env.VITE_FIREBASE_API_KEY],
    ['VITE_FIREBASE_AUTH_DOMAIN',         import.meta.env.VITE_FIREBASE_AUTH_DOMAIN],
    ['VITE_FIREBASE_PROJECT_ID',          import.meta.env.VITE_FIREBASE_PROJECT_ID],
    ['VITE_FIREBASE_STORAGE_BUCKET',      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET],
    ['VITE_FIREBASE_MESSAGING_SENDER_ID', import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID],
    ['VITE_FIREBASE_APP_ID',              import.meta.env.VITE_FIREBASE_APP_ID],
    ['VITE_STORE_ID',                     import.meta.env.VITE_STORE_ID],
    ['VITE_FIREBASE_VAPID_KEY',           import.meta.env.VITE_FIREBASE_VAPID_KEY],
].filter(([, v]) => !v).map(([k]) => k);

if (missingVars.length > 0) {
    console.error('❌ [Firebase] Variables de entorno FALTANTES:', missingVars);
} else if (import.meta.env.DEV) {
    console.log('✅ [Firebase] Credenciales cargadas. Project ID:', import.meta.env.VITE_FIREBASE_PROJECT_ID);
}

export const app   = initializeApp(firebaseConfig);
export const auth  = getAuth(app);
export const appId = import.meta.env.VITE_STORE_ID || 'tienda-principal';

// ─────────────────────────────────────────────────────────────────────────────
// LAZY — Firestore, Storage y Messaging se cargan de forma diferida.
// Se inicia la carga INMEDIATAMENTE en segundo plano, pero no bloquea el
// primer render. Para cuando onAuthStateChanged dispara (~200-400ms),
// el módulo ya está listo.
//
// Los hooks usan getDb() en lugar de db directamente. Como todos los hooks
// que necesitan Firestore corren dentro de useEffect / funciones async
// (nunca en el render path), esto es 100% seguro.
// ─────────────────────────────────────────────────────────────────────────────
let _db      = null;
let _storage = null;

const _dbReady = import('firebase/firestore').then(
    ({ initializeFirestore, persistentLocalCache, enableNetwork }) => {
        _db = initializeFirestore(app, { localCache: persistentLocalCache() });
        enableNetwork(_db)
            .then(() => { if (import.meta.env.DEV) console.log('✅ [Firestore] Red habilitada'); })
            .catch(e  => console.error('❌ [Firestore] Error al habilitar red:', e.message));
        return _db;
    }
);

const _storageReady = import('firebase/storage').then(({ getStorage }) => {
    _storage = getStorage(app);
    return _storage;
});

/**
 * getDb() — devuelve la instancia de Firestore.
 * Uso: const db = await getDb();
 * La primera llamada espera la carga diferida; las siguientes son instantáneas.
 */
export const getDb = () => (_db ? Promise.resolve(_db) : _dbReady);

/**
 * getStorageInstance() — análogo a getDb() para Storage.
 */
export const getStorageInstance = () =>
    (_storage ? Promise.resolve(_storage) : _storageReady);

/**
 * getMessagingInstance() — FCM, solo si el navegador lo soporta.
 */
export const getMessagingInstance = async () => {
    const { isSupported, getMessaging } = await import('firebase/messaging');
    const supported = await isSupported();
    if (!supported) return null;
    return getMessaging(app);
};

export default app;
