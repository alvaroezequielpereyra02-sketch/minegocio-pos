import { useState, useEffect } from 'react';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail
} from 'firebase/auth';
import {
    doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, updateDoc, writeBatch
} from 'firebase/firestore';
import { auth, db, appId } from '../config/firebase';

export const useAuth = () => {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [loginError, setLoginError] = useState('');

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
                    console.log("Auth offline:", e);
                }
            } else {
                setUserData(null);
            }
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const login = async (email, password) => {
        try {
            setLoginError('');
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            setLoginError("Credenciales incorrectas.");
        }
    };

    const register = async (form) => {
        try {
            setLoginError('');
            const email = form.email.value.trim().toLowerCase();
            // Normalizamos el teléfono (quitamos espacios y guiones para comparar mejor)
            const rawPhone = form.phone.value.trim();
            const phone = rawPhone.replace(/\D/g, ''); // Solo números
            const inviteCode = form.inviteCode.value.trim().toUpperCase();

            // 1. Validar código de invitación
            const codesRef = collection(db, 'stores', appId, 'invitation_codes');
            const qCode = query(codesRef, where('code', '==', inviteCode), where('status', '==', 'active'));
            const codeSnap = await getDocs(qCode);

            if (codeSnap.empty) throw new Error("Código inválido o usado.");
            const codeDoc = codeSnap.docs[0];

            // 2. BUSQUEDA INTELIGENTE DE CLIENTE PREVIO (Email O Teléfono)
            const customersRef = collection(db, 'stores', appId, 'customers');

            // A) Buscar por Email
            const qEmail = query(customersRef, where('email', '==', email));
            const snapEmail = await getDocs(qEmail);

            // B) Buscar por Teléfono (si no se encontró por email)
            // Nota: Buscamos el teléfono tal cual lo ingresó el usuario. 
            // Idealmente deberías guardar los teléfonos limpios en la BD para que esto sea infalible.
            const qPhone = query(customersRef, where('phone', '==', rawPhone));
            const snapPhone = await getDocs(qPhone);

            let oldCustomerId = null;
            let oldCustomerData = {};
            let foundBy = '';

            if (!snapEmail.empty) {
                const oldDoc = snapEmail.docs[0];
                oldCustomerId = oldDoc.id;
                oldCustomerData = oldDoc.data();
                foundBy = 'email';
            } else if (!snapPhone.empty) {
                const oldDoc = snapPhone.docs[0];
                oldCustomerId = oldDoc.id;
                oldCustomerData = oldDoc.data();
                foundBy = 'phone';
            }

            if (oldCustomerId) {
                console.log(`Perfil previo encontrado por ${foundBy}, fusionando ID:`, oldCustomerId);
            }

            // 3. Crear usuario en Firebase Auth (Siempre usa email/pass)
            const userCredential = await createUserWithEmailAndPassword(auth, email, form.password.value);
            const uid = userCredential.user.uid;

            // 4. Preparar datos (fusionando lo viejo con lo nuevo)
            const newUserData = {
                email: email,
                name: form.name.value,
                phone: rawPhone,
                address: form.address.value,
                role: 'client',
                createdAt: oldCustomerData.createdAt || serverTimestamp(),
                lastLogin: serverTimestamp()
            };

            // Datos específicos de la tienda (mantener contadores viejos)
            const storeCustomerData = {
                ...newUserData,
                platformOrdersCount: oldCustomerData.platformOrdersCount || 0,
                externalOrdersCount: oldCustomerData.externalOrdersCount || 0,
                lastPurchase: oldCustomerData.lastPurchase || null
            };

            // 5. Ejecutar escritura atómica (Batch)
            const batch = writeBatch(db);

            // A) Crear perfil global
            batch.set(doc(db, 'users', uid), newUserData);

            // B) Crear el NUEVO documento de cliente con el UID correcto
            batch.set(doc(db, 'stores', appId, 'customers', uid), storeCustomerData);

            // C) Marcar código como usado
            batch.update(doc(db, 'stores', appId, 'invitation_codes', codeDoc.id), {
                status: 'used',
                usedBy: uid,
                usedAt: serverTimestamp()
            });

            // D) Si existía un perfil viejo (manual), BORRARLO para no tener duplicados
            if (oldCustomerId) {
                batch.delete(doc(db, 'stores', appId, 'customers', oldCustomerId));
            }

            await batch.commit();

            // 6. MIGRACIÓN DE HISTORIAL (Transacciones)
            if (oldCustomerId) {
                const transRef = collection(db, 'stores', appId, 'transactions');
                const qTrans = query(transRef, where('clientId', '==', oldCustomerId));
                const transSnap = await getDocs(qTrans);

                if (!transSnap.empty) {
                    const transBatch = writeBatch(db);
                    transSnap.forEach(tDoc => {
                        transBatch.update(tDoc.ref, {
                            clientId: uid,
                            clientName: newUserData.name // Actualizamos nombre al real
                        });
                    });
                    await transBatch.commit();
                    console.log(`Se migraron ${transSnap.size} ventas al nuevo perfil.`);
                }
            }

        } catch (error) {
            console.error("Error en registro:", error);
            if (error.code === 'auth/email-already-in-use') {
                setLoginError("Este correo ya está registrado. Intenta iniciar sesión.");
            } else {
                setLoginError(error.message);
            }
            throw error;
        }
    };

    const logout = async () => {
        await signOut(auth);
        setUserData(null);
    };

    const resetPassword = async (email) => {
        if (!email) throw new Error("Email requerido");
        await sendPasswordResetEmail(auth, email);
    };

    return { user, userData, authLoading, loginError, setLoginError, login, register, logout, resetPassword };
};