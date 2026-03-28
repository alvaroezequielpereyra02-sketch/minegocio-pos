import { useState, useEffect, useRef, useCallback } from 'react';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    getIdTokenResult,
} from 'firebase/auth';
import {
    doc, getDoc, onSnapshot, setDoc, serverTimestamp,
    collection, query, where, getDocs, getDocsFromServer, updateDoc
} from 'firebase/firestore';

// ✅ Importamos las instancias ya inicializadas en lugar de crearlas en cada render
import { auth, db, appId } from '../config/firebase';

export const useAuth = () => {
    const [user, setUser]               = useState(null);
    const [userData, setUserData]       = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [loginError, setLoginError]   = useState('');

    // Ref al usuario actual para accederlo desde los event listeners
    // sin crear dependencias en useEffect
    const currentUserRef = useRef(null);

    // ── Función centralizada para leer el rol desde el JWT ────────────────────
    // forceRefresh: true  → va a Firebase Auth a buscar el token fresco del servidor
    // forceRefresh: false → usa el token cacheado en memoria (sin request extra)
    const resolveRole = useCallback(async (firebaseUser, forceRefresh = false) => {
        if (!firebaseUser) return null;
        try {
            const tokenResult = await getIdTokenResult(firebaseUser, forceRefresh);
            return tokenResult.claims.role || null;
        } catch {
            // Offline o token inválido — usamos el rol de Firestore como fallback
            return null;
        }
    }, []);

    // ── Refrescar el token y actualizar userData en vivo ──────────────────────
    // Se llama al volver online y al recuperar el foco de la ventana.
    const refreshRole = useCallback(async () => {
        const firebaseUser = currentUserRef.current;
        if (!firebaseUser) return;
        const claimsRole = await resolveRole(firebaseUser, true); // forceRefresh: true
        if (claimsRole) {
            setUserData(prev => prev ? { ...prev, role: claimsRole } : prev);
        }
    }, [resolveRole]);

    useEffect(() => {
        let unsubUserData = () => {};
        // Marca si es la primera carga del snapshot para ese usuario.
        // Primera carga (incluye recarga de página) → forceRefresh: true
        // Actualizaciones posteriores del snapshot → forceRefresh: false (caché, sin costo)
        let isFirstSnapshot = true;

        const authTimeout = setTimeout(() => setAuthLoading(false), 6000);

        const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
            unsubUserData();
            currentUserRef.current = firebaseUser;
            isFirstSnapshot = true; // reset al cambiar de usuario o recargar

            if (firebaseUser) {
                setUser(firebaseUser);
                unsubUserData = onSnapshot(
                    doc(db, 'users', firebaseUser.uid),
                    async (userDoc) => {
                        clearTimeout(authTimeout);

                        // Primera vez: forzamos refresh para tener el rol más reciente.
                        // Resto de snapshots: usamos caché para no generar requests innecesarios.
                        const shouldForce = isFirstSnapshot;
                        isFirstSnapshot = false;

                        const claimsRole = await resolveRole(firebaseUser, shouldForce);

                        if (userDoc.exists()) {
                            const firestoreData = userDoc.data();
                            setUserData({
                                ...firestoreData,
                                role: claimsRole || firestoreData.role || 'client',
                            });
                        } else if (navigator.onLine) {
                            setTimeout(async () => {
                                const retryDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
                                if (!retryDoc.exists()) {
                                    signOut(auth);
                                    setUserData(null);
                                    setUser(null);
                                } else {
                                    const firestoreData = retryDoc.data();
                                    setUserData({
                                        ...firestoreData,
                                        role: claimsRole || firestoreData.role || 'client',
                                    });
                                }
                            }, 3000);
                        }
                        setAuthLoading(false);
                    },
                    () => { clearTimeout(authTimeout); setAuthLoading(false); }
                );
            } else {
                clearTimeout(authTimeout);
                setUser(null);
                setUserData(null);
                setAuthLoading(false);
            }
        });

        // ── Refrescar rol al volver online ────────────────────────────────────
        // El rol puede haber cambiado en el servidor mientras el usuario estaba offline.
        const handleOnline = () => refreshRole();

        // ── Refrescar rol al recuperar el foco de la ventana ─────────────────
        // El usuario abre otra pestaña, cambia algo en Firebase Console,
        // vuelve a la app — el rol se actualiza sin necesidad de recargar.
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') refreshRole();
        };

        window.addEventListener('online', handleOnline);
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            unsubAuth();
            unsubUserData();
            window.removeEventListener('online', handleOnline);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [resolveRole, refreshRole]);

    const login = async (email, password) => {
        try {
            setLoginError('');
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            setLoginError("Credenciales incorrectas.");
            throw error;
        }
    };

    const validateInviteCode = async (code) => {
        if (!code) throw new Error("Código de invitación requerido.");
        const codesRef = collection(db, 'stores', appId, 'invitation_codes');
        const q = query(codesRef, where('code', '==', code.toUpperCase()), where('status', '==', 'active'));
        const snapshot = await getDocsFromServer(q);
        if (snapshot.empty) throw new Error("Código de invitación inválido o ya utilizado.");
        return snapshot.docs[0];
    };

    const register = async ({ email, password, name, phone, address, inviteCode }) => {
        try {
            setLoginError('');
            const inviteDoc = await validateInviteCode(inviteCode);
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const uid = userCredential.user.uid;

            const newUserData = {
                email, name, phone, address,
                inviteCode: inviteCode.toUpperCase(),
                role: 'client',
                createdAt: serverTimestamp()
            };

            try {
                // ✅ FIX: si alguno de estos setDoc falla (red o reglas de Firestore),
                // el usuario ya existe en Auth pero sin documento → loop infinito de carga
                // y no puede re-registrarse con el mismo email.
                // Solución: eliminar el usuario de Auth en el catch para mantener consistencia.
                await setDoc(doc(db, 'users', uid), newUserData);
                await setDoc(doc(db, 'stores', appId, 'customers', uid), { ...newUserData, userId: uid });
                await updateDoc(doc(db, 'stores', appId, 'invitation_codes', inviteDoc.id), {
                    status: 'used', usedBy: uid, usedAt: serverTimestamp()
                });
            } catch (firestoreError) {
                // Revertir: borrar el usuario de Auth para evitar cuenta huérfana
                await userCredential.user.delete();
                throw firestoreError;
            }

            return userCredential.user;
        } catch (error) {
            setLoginError(error.message);
            throw error;
        }
    };

    const logout = async () => {
        await signOut(auth);
        setUserData(null);
    };

    const resetPassword = async (email) => {
        if (!email) {
            setLoginError("Escribe tu correo primero.");
            throw new Error("Email requerido");
        }
        await sendPasswordResetEmail(auth, email);
    };

    return {
        user, userData, authLoading,
        loginError, setLoginError,
        login, register, logout, resetPassword
    };
};
