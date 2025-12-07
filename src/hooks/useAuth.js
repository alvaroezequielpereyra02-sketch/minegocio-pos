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

    const register = async ({ email, password, name, phone, address }) => {
        try {
            setLoginError('');
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const newUserData = {
                email, name, phone, address,
                role: 'client',
                createdAt: serverTimestamp()
            };
            // Guardar perfil extendido en Firestore
            await setDoc(doc(db, 'users', userCredential.user.uid), newUserData);
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