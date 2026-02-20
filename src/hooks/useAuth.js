import { useState, useEffect } from 'react';
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail
} from 'firebase/auth';
import {
    getFirestore, doc, getDoc, setDoc, serverTimestamp,
    collection, query, where, getDocs, updateDoc
} from 'firebase/firestore';
import { appId } from '../config/firebase';

export const useAuth = (app) => {
    const [user, setUser]           = useState(null);
    const [userData, setUserData]   = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [loginError, setLoginError]   = useState('');

    const auth = getAuth(app);
    const db   = getFirestore(app);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                try {
                    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                    if (userDoc.exists()) {
                        setUserData(userDoc.data());
                    } else if (navigator.onLine) {
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

    const login = async (email, password) => {
        try {
            setLoginError('');
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            setLoginError("Credenciales incorrectas.");
            throw error;
        }
    };

    // Valida el código de invitación contra la colección de Firestore
    const validateInviteCode = async (code) => {
        if (!code) throw new Error("Código de invitación requerido.");

        const codesRef = collection(db, 'stores', appId, 'invitation_codes');
        const q = query(codesRef, where('code', '==', code.toUpperCase()), where('status', '==', 'active'));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            throw new Error("Código de invitación inválido o ya utilizado.");
        }

        // Devolvemos el doc para marcarlo como usado después del registro
        return snapshot.docs[0];
    };

    const register = async ({ email, password, name, phone, address, inviteCode }) => {
        try {
            setLoginError('');

            // 1. Validar código ANTES de crear el usuario
            const inviteDoc = await validateInviteCode(inviteCode);

            // 2. Crear usuario en Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const uid = userCredential.user.uid;

            const newUserData = {
                email, name, phone, address,
                inviteCode: inviteCode.toUpperCase(),
                role: 'client',
                createdAt: serverTimestamp()
            };

            // 3. Guardar perfil en colección global de usuarios
            await setDoc(doc(db, 'users', uid), newUserData);

            // 4. Guardar también en la colección de clientes de la tienda
            await setDoc(doc(db, 'stores', appId, 'customers', uid), {
                ...newUserData,
                userId: uid
            });

            // 5. Marcar el código como usado para que no se reutilice
            await updateDoc(doc(db, 'stores', appId, 'invitation_codes', inviteDoc.id), {
                status: 'used',
                usedBy: uid,
                usedAt: serverTimestamp()
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
