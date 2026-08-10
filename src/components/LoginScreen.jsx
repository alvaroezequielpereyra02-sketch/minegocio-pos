import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Store, Users } from 'lucide-react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

/**
 * LoginScreen
 *
 * Reemplaza el formulario de email/contraseña por el botón de Google.
 * Dos modos:
 * - "Soy cliente"    → loginWithGoogle. Si es la primera vez, el backend crea
 *                       la cuenta como cliente y App.jsx redirige a
 *                       CompleteProfileScreen automáticamente.
 * - "Soy del equipo" → pide un código de invitación y llama a
 *                       registerWithInvite. El rol (admin/employee) lo decide
 *                       el código, nunca el frontend.
 */
export default function LoginScreen({
    storeProfile,
    loginWithGoogle,
    registerWithInvite,
    loginError,
    setLoginError,
}) {
    const [mode, setMode]               = useState('client'); // 'client' | 'employee'
    const [inviteCode, setInviteCode]   = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [scriptLoaded, setScriptLoaded] = useState(false);
    const buttonRef = useRef(null);

    // El callback de Google se registra una sola vez en initialize().
    // Usamos refs para que siempre lea el modo/código actuales sin tener
    // que re-inicializar el SDK en cada cambio de estado.
    const modeRef = useRef(mode);
    const inviteCodeRef = useRef(inviteCode);
    useEffect(() => { modeRef.current = mode; }, [mode]);
    useEffect(() => { inviteCodeRef.current = inviteCode; }, [inviteCode]);

    // loginWithGoogle/registerWithInvite/setLoginError vienen de useAuth() y se
    // recrean en cada render (no están envueltas en useCallback ahí). Sin esta
    // ref, handleCredential cambiaría de identidad en cada render y arrastraría
    // al efecto de initialize() de más abajo, causando el warning de GSI
    // "initialize() is called multiple times".
    const authFnsRef = useRef({ loginWithGoogle, registerWithInvite, setLoginError });
    useEffect(() => {
        authFnsRef.current = { loginWithGoogle, registerWithInvite, setLoginError };
    }, [loginWithGoogle, registerWithInvite, setLoginError]);

    const handleCredential = useCallback(async (response) => {
        setIsSubmitting(true);
        authFnsRef.current.setLoginError('');
        try {
            if (modeRef.current === 'employee') {
                if (!inviteCodeRef.current.trim()) {
                    authFnsRef.current.setLoginError('Ingresá tu código de invitación.');
                    setIsSubmitting(false);
                    return;
                }
                await authFnsRef.current.registerWithInvite({
                    credential: response.credential,
                    inviteCode: inviteCodeRef.current,
                });
            } else {
                await authFnsRef.current.loginWithGoogle(response.credential);
            }
        } catch {
            // El mensaje de error ya quedó seteado en loginError desde useAuth.
        } finally {
            setIsSubmitting(false);
        }
    }, []); // estable: nunca cambia de identidad, así initialize() no se repite

    // Carga el script de Google Identity Services una sola vez.
    useEffect(() => {
        if (window.google?.accounts?.id) {
            setScriptLoaded(true);
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => setScriptLoaded(true);
        document.head.appendChild(script);
    }, []);

    // Inicializa y dibuja el botón cuando el script está listo. Se vuelve a
    // dibujar si cambia el modo, para que el texto acompañe (Ingresar/Continuar).
    useEffect(() => {
        if (!scriptLoaded || !window.google?.accounts?.id || !buttonRef.current) return;

        window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredential,
            auto_select: false,
        });

        buttonRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(buttonRef.current, {
            theme: 'filled_black',
            size: 'large',
            shape: 'pill',
            width: 296,
            text: mode === 'employee' ? 'continue_with' : 'signin_with',
        });
    }, [scriptLoaded, mode, handleCredential]);

    return (
        <main className="min-h-screen login-bg flex items-center justify-center p-4" aria-label="Inicio de sesión">
            <div className="w-full max-w-sm">

                {/* Logo y nombre de tienda */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto mb-4 ring-2 ring-orange-500/30 flex items-center justify-center bg-orange-500/20">
                        {storeProfile?.logoUrl
                            ? <img src={storeProfile.logoUrl} className="w-full h-full object-cover" alt="logo" />
                            : <Store size={32} className="text-orange-400" />}
                    </div>
                    <h1 className="text-white text-2xl font-black">{storeProfile?.name}</h1>
                    <p className="text-white/40 text-sm mt-1">
                        {mode === 'employee' ? 'Acceso de equipo' : 'Iniciá sesión para continuar'}
                    </p>
                </div>

                {/* Card */}
                <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-6 border border-white/15 shadow-2xl">

                    {/* Selector cliente / empleado */}
                    <div className="grid grid-cols-2 gap-2 mb-5 p-1 rounded-xl bg-white/5">
                        <button
                            type="button"
                            onClick={() => { setMode('client'); setLoginError(''); }}
                            className={`py-2 rounded-lg text-xs font-bold transition-colors ${
                                mode === 'client' ? 'btn-accent' : 'text-white/40 hover:text-white/70'
                            }`}
                        >
                            Soy cliente
                        </button>
                        <button
                            type="button"
                            onClick={() => { setMode('employee'); setLoginError(''); }}
                            className={`py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                                mode === 'employee' ? 'btn-accent' : 'text-white/40 hover:text-white/70'
                            }`}
                        >
                            <Users size={14} /> Soy del equipo
                        </button>
                    </div>

                    {mode === 'employee' && (
                        <input
                            value={inviteCode}
                            onChange={(e) => setInviteCode(e.target.value)}
                            autoComplete="off"
                            className="w-full mb-3 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 outline-none focus:border-orange-400 transition-colors text-sm font-bold text-center uppercase tracking-widest"
                            placeholder="CÓDIGO DE INVITACIÓN"
                        />
                    )}

                    {loginError && (
                        <div className="text-red-400 text-xs text-center font-medium py-1 mb-3">
                            {loginError}
                        </div>
                    )}

                    <p className="text-white/30 text-xs text-center mb-4 leading-relaxed">
                        {mode === 'employee'
                            ? 'Pedile el código a un administrador si todavía no lo tenés.'
                            : 'Usamos tu cuenta de Google — no hace falta crear otra contraseña.'}
                    </p>

                    {/* El botón real de Google se dibuja acá adentro */}
                    <div className="flex justify-center min-h-[44px]">
                        {!scriptLoaded && (
                            <div className="text-white/30 text-xs py-3">Cargando…</div>
                        )}
                        <div
                            ref={buttonRef}
                            style={{ opacity: isSubmitting ? 0.5 : 1, pointerEvents: isSubmitting ? 'none' : 'auto' }}
                        />
                    </div>

                    {isSubmitting && (
                        <p className="text-white/40 text-xs text-center mt-3">Verificando…</p>
                    )}
                </div>
            </div>
        </main>
    );
}
