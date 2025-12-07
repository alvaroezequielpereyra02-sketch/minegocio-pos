import { useState, useEffect } from 'react';
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { appId } from '../config/firebase'; // <--- IMPORTANTE: Importamos el ID de la tienda

export const useAuth = (app) => {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [loginError, setLoginError] = useState('');

    const auth = getAuth(app);
    const db = getFirestore(app);

    // Escuchar cambios en la sesión
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                try {
                    // Intentar cargar datos extra del usuario (rol, teléfono, etc.)
                    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                    if (userDoc.exists()) {
                        setUserData(userDoc.data());
                    } else if (navigator.onLine) {
                        // Si hay internet y no existe perfil, forzar logout por seguridad
                        // (Opcional: podrías permitirlo si quieres que se autorepare, pero mejor logout)
                        await signOut(auth);
                        setUserData(null);
                        setUser(null);
                    }
                } catch (e) {
                    console.log("Error auth offline (ignorable):", e);
                }
            } else {
                setUserData(null);
            }
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, [auth, db]);

    // Funciones de acción
    const login = async (email, password) => {
        try {
            setLoginError('');
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            console.error(error);
            setLoginError("Credenciales incorrectas.");
            throw error;
        }
    };

    const register = async ({ email, password, name, phone, address, inviteCode }) => {
        try {
            setLoginError('');
            // 1. Crear usuario en Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const uid = userCredential.user.uid;

            const newUserData = {
                email,
                name,
                phone,
                address,
                inviteCode: inviteCode || '',
                role: 'client',
                createdAt: serverTimestamp()
            };

            // 2. Guardar en colección global de USUARIOS (Para login y roles)
            await setDoc(doc(db, 'users', uid), newUserData);

            // 3. Guardar TAMBIÉN en colección de CLIENTES de la tienda (Para que aparezca en la lista del admin)
            // Usamos el mismo UID para que sea fácil de relacionar
            await setDoc(doc(db, 'stores', appId, 'customers', uid), {
                ...newUserData,
                userId: uid // Referencia al ID de Auth
            });

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
        user,
        userData,
        authLoading,
        loginError,
        setLoginError,
        login,
        register,
        logout,
        resetPassword
    };
};