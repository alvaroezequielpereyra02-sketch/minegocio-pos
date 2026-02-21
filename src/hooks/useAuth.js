import { useState, useEffect } from 'react';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail
} from 'firebase/auth';
import {
    doc, getDoc, onSnapshot, setDoc, serverTimestamp,
    collection, query, where, getDocs, updateDoc
} from 'firebase/firestore';

// ✅ Importamos las instancias ya inicializadas en lugar de crearlas en cada render
import { auth, db, appId } from '../config/firebase';

export const useAuth = () => {  // ✅ Ya no recibe `app` como parámetro
    const [user, setUser]               = useState(null);
    const [userData, setUserData]       = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [loginError, setLoginError]   = useState('');

    useEffect(() => {
        let unsubUserData = () => {};

        // ✅ onAuthStateChanged detecta login/logout
        const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
            // Limpiamos la suscripción anterior al perfil si el usuario cambia
            unsubUserData();

            if (currentUser) {
                setUser(currentUser);
                // ✅ onSnapshot en lugar de getDoc: detecta cambios de rol en tiempo real
                // Si el admin cambia el rol de este usuario, se aplica sin necesidad de re-login
                unsubUserData = onSnapshot(
                    doc(db, 'users', currentUser.uid),
                    (userDoc) => {
                        if (userDoc.exists()) {
                            setUserData(userDoc.data());
                        } else if (navigator.onLine) {
                            signOut(auth);
                            setUserData(null);
                            setUser(null);
                        }
                        setAuthLoading(false);
                    },
                    (e) => {
                        // Error offline: ignorable, Firestore usa caché local
                        console.log("Error auth offline (ignorable):", e);
                        setAuthLoading(false);
                    }
                );
            } else {
                setUser(null);
                setUserData(null);
                setAuthLoading(false);
            }
        });

        return () => {
            unsubAuth();
            unsubUserData();
        };
    }, []); // ✅ Sin dependencias: auth y db son estables

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
        const snapshot = await getDocs(q);
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

            await setDoc(doc(db, 'users', uid), newUserData);
            await setDoc(doc(db, 'stores', appId, 'customers', uid), { ...newUserData, userId: uid });
            await updateDoc(doc(db, 'stores', appId, 'invitation_codes', inviteDoc.id), {
                status: 'used', usedBy: uid, usedAt: serverTimestamp()
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
        user, userData, authLoading,
        loginError, setLoginError,
        login, register, logout, resetPassword
    };
};
