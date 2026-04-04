import React, { useState, useEffect } from 'react';
import { getAuth, confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Store, Eye, EyeOff, CheckCircle, XCircle, Loader2, Lock } from 'lucide-react';
import { db, appId, app } from '../config/firebase';

// getAuth(app) es idempotente — siempre devuelve la misma instancia.
// Llamarlo fuera del componente evita ejecutarlo en cada render.
const auth = getAuth(app);

/**
 * ResetPasswordPage
 *
 * Página independiente — no necesita Auth ni los contextos de la app.
 * Se monta directamente desde main.jsx cuando la URL contiene
 * ?mode=resetPassword&oobCode=...
 *
 * Flujo:
 *  1. Verifica que el oobCode sea válido (no expirado, no usado)
 *  2. Muestra formulario con el estilo visual de la tienda
 *  3. Al guardar, llama a confirmPasswordReset y redirige al login
 */
// Definido fuera del componente para evitar unmount/remount en cada
// keystroke del input de contraseña, lo que causaba un flash visual.
const PasswordStrength = ({ value }) => {
    if (!value) return null;
    const len      = value.length;
    const hasUpper = /[A-Z]/.test(value);
    const hasNum   = /[0-9]/.test(value);
    const score    = (len >= 8 ? 1 : 0) + (len >= 12 ? 1 : 0) + (hasUpper ? 1 : 0) + (hasNum ? 1 : 0);

    const labels = ['Muy débil', 'Débil', 'Regular', 'Fuerte', 'Muy fuerte'];
    const colors = ['bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-lime-400', 'bg-green-500'];

    return (
        <div className="mt-2">
            <div className="flex gap-1">
                {[0,1,2,3].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= score ? colors[score] : 'bg-white/20'}`} />
                ))}
            </div>
            <p className="text-[10px] text-white/40 mt-1">{labels[score]}</p>
        </div>
    );
};

export default function ResetPasswordPage({ oobCode }) {
    // auth disponible como módulo-level constant (ver arriba)

    // ── Estado de la verificación del código ──────────────────────────────────
    const [verifyStatus, setVerifyStatus] = useState('loading'); // loading | valid | expired | used
    const [userEmail, setUserEmail]       = useState('');

    // ── Estado del formulario ─────────────────────────────────────────────────
    const [password, setPassword]               = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword]       = useState(false);
    const [isSubmitting, setIsSubmitting]       = useState(false);
    const [submitStatus, setSubmitStatus]       = useState(null); // null | 'success' | 'error'
    const [errorMsg, setErrorMsg]               = useState('');

    // ── Perfil de la tienda (para el logo y nombre) ───────────────────────────
    const [storeProfile, setStoreProfile] = useState({ name: 'MiNegocio POS', logoUrl: '' });

    // ── Forzar fondo oscuro en el body mientras esta página está activa ───────
    // Sin esto, el fondo crema (#F5F0E8) del body se filtra en la mitad
    // inferior de la pantalla porque el componente no cubre el scroll del body.
    useEffect(() => {
        const prev = document.body.style.background;
        document.body.style.background = '#1c0f05';
        return () => { document.body.style.background = prev; };
    }, []);

    // ── 1. Cargar perfil de la tienda ─────────────────────────────────────────
    useEffect(() => {
        getDoc(doc(db, 'stores', appId, 'settings', 'profile'))
            .then(d => { if (d.exists()) setStoreProfile(d.data()); })
            .catch(() => {}); // silencioso — usa el fallback
    }, []);

    // ── 2. Verificar que el código sea válido ─────────────────────────────────
    useEffect(() => {
        if (!oobCode) { setVerifyStatus('expired'); return; }
        verifyPasswordResetCode(auth, oobCode)
            .then(email => { setUserEmail(email); setVerifyStatus('valid'); })
            .catch(err => {
                if (err.code === 'auth/invalid-action-code') setVerifyStatus('used');
                else setVerifyStatus('expired');
            });
    }, [oobCode]);

    // ── 3. Guardar nueva contraseña ───────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (password.length < 6) {
            setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
            return;
        }
        if (password !== confirmPassword) {
            setErrorMsg('Las contraseñas no coinciden.');
            return;
        }

        setIsSubmitting(true);
        try {
            await confirmPasswordReset(auth, oobCode, password);
            setSubmitStatus('success');
            // Limpiar los params de la URL y redirigir al login después de 3 segundos.
            // El cleanup evita el redirect si el componente se desmonta antes.
            const redirectTimer = setTimeout(() => {
                window.location.href = window.location.origin;
            }, 3000);
            return () => clearTimeout(redirectTimer);
        } catch (err) {
            setSubmitStatus('error');
            if (err.code === 'auth/invalid-action-code') {
                setErrorMsg('El link ya fue usado o expiró. Solicitá uno nuevo desde la app.');
            } else if (err.code === 'auth/weak-password') {
                setErrorMsg('La contraseña es muy débil. Usá al menos 6 caracteres.');
            } else {
                setErrorMsg('Ocurrió un error inesperado. Intentá de nuevo.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        // fixed inset-0 garantiza cobertura completa del viewport sin importar
        // la altura de #root o el background del body.
        // overflow-y-auto permite scroll si el formulario es más alto que la pantalla.
        <div className="fixed inset-0 overflow-y-auto login-bg flex items-center justify-center p-4">
            <div className="w-full max-w-sm">

                {/* Logo y nombre de tienda */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto mb-4 ring-2 ring-orange-500/30 flex items-center justify-center bg-orange-500/20">
                        {storeProfile.logoUrl
                            ? <img src={storeProfile.logoUrl} className="w-full h-full object-cover" alt="logo" />
                            : <Store size={32} className="text-orange-400" />}
                    </div>
                    <h1 className="text-white text-2xl font-black">{storeProfile.name}</h1>
                    <p className="text-white/40 text-sm mt-1">Restablecer contraseña</p>
                </div>

                <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-6 border border-white/15 shadow-2xl">

                    {/* ── Estado: Verificando ── */}
                    {verifyStatus === 'loading' && (
                        <div className="flex flex-col items-center py-8 gap-3">
                            <Loader2 size={32} className="text-orange-400 animate-spin" />
                            <p className="text-white/60 text-sm">Verificando el link...</p>
                        </div>
                    )}

                    {/* ── Estado: Expirado o ya usado ── */}
                    {(verifyStatus === 'expired' || verifyStatus === 'used') && (
                        <div className="flex flex-col items-center py-6 gap-4 text-center">
                            <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center">
                                <XCircle size={28} className="text-red-400" />
                            </div>
                            <div>
                                <p className="text-white font-bold text-base">
                                    {verifyStatus === 'used' ? 'Link ya utilizado' : 'Link expirado'}
                                </p>
                                <p className="text-white/50 text-sm mt-2 leading-relaxed">
                                    {verifyStatus === 'used'
                                        ? 'Este link de recuperación ya fue usado. Si necesitás cambiar la contraseña de nuevo, solicitá uno nuevo.'
                                        : 'El link de recuperación venció. Los links son válidos por 1 hora. Solicitá uno nuevo desde la pantalla de inicio.'}
                                </p>
                            </div>
                            <button
                                onClick={() => { window.location.href = window.location.origin; }}
                                className="w-full py-3 rounded-xl font-black text-sm btn-accent mt-2"
                            >
                                Volver al inicio
                            </button>
                        </div>
                    )}

                    {/* ── Estado: Éxito ── */}
                    {submitStatus === 'success' && (
                        <div className="flex flex-col items-center py-6 gap-4 text-center">
                            <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center">
                                <CheckCircle size={28} className="text-green-400" />
                            </div>
                            <div>
                                <p className="text-white font-bold text-base">¡Contraseña actualizada!</p>
                                <p className="text-white/50 text-sm mt-2">
                                    Ya podés iniciar sesión con tu nueva contraseña. Redirigiendo...
                                </p>
                            </div>
                            <Loader2 size={18} className="text-white/30 animate-spin" />
                        </div>
                    )}

                    {/* ── Estado: Formulario activo ── */}
                    {verifyStatus === 'valid' && submitStatus !== 'success' && (
                        <form onSubmit={handleSubmit} className="space-y-4">

                            {/* Email (solo lectura — para que el password manager lo asocie) */}
                            {userEmail && (
                                <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                                    <p className="text-white/30 text-[10px] uppercase tracking-wider mb-0.5">Cuenta</p>
                                    <p className="text-white/70 text-sm font-medium truncate">{userEmail}</p>
                                </div>
                            )}

                            {/* Nueva contraseña */}
                            <div>
                                <div className="relative">
                                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        required
                                        autoComplete="new-password"
                                        placeholder="Nueva contraseña"
                                        className="w-full pl-10 pr-10 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 outline-none focus:border-orange-400 transition-colors text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(v => !v)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <PasswordStrength value={password} />
                            </div>

                            {/* Confirmar contraseña */}
                            <div className="relative">
                                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    required
                                    autoComplete="new-password"
                                    placeholder="Repetí la contraseña"
                                    className={`w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border text-white placeholder:text-white/30 outline-none transition-colors text-sm ${
                                        confirmPassword && password !== confirmPassword
                                            ? 'border-red-400'
                                            : confirmPassword && password === confirmPassword
                                            ? 'border-green-400'
                                            : 'border-white/20 focus:border-orange-400'
                                    }`}
                                />
                            </div>

                            {/* Error */}
                            {errorMsg && (
                                <p className="text-red-400 text-xs text-center font-medium">{errorMsg}</p>
                            )}

                            {/* Botón */}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-3.5 rounded-xl font-black text-sm btn-accent disabled:opacity-60 flex items-center justify-center gap-2"
                            >
                                {isSubmitting
                                    ? <><Loader2 size={16} className="animate-spin" /> Guardando...</>
                                    : 'Guardar nueva contraseña'
                                }
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
