import React, { useState } from 'react';
import { Store } from 'lucide-react';

/**
 * LoginScreen
 * Formulario de inicio de sesión y registro de nuevos usuarios.
 */
export default function LoginScreen({
    storeProfile,
    login,
    register,
    resetPassword,
    loginError,
    setLoginError,
    showNotification,
}) {
    const [isRegistering, setIsRegistering] = useState(false);
    // Estado controlado del email — compartido entre el form y el botón de recuperación.
    // Reemplaza el document.querySelector que era frágil y podía devolver null.
    const [email, setEmail] = useState('');
    const [isSendingReset, setIsSendingReset] = useState(false);
    // Mensaje de éxito inline para el reseteo de contraseña.
    // NO usamos showNotification porque ese toast se renderiza dentro del JSX
    // principal de App.jsx, que no está montado cuando LoginScreen hace su propio
    // return anticipado. El mensaje nunca aparecería en pantalla.
    const [resetSuccessMsg, setResetSuccessMsg] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        try {
            if (isRegistering) {
                await register({
                    name:       form.name.value,
                    phone:      form.phone.value,
                    address:    form.address.value,
                    email:      email,
                    password:   form.password.value,
                    inviteCode: form.inviteCode?.value || '',
                });
            } else {
                await login(email, form.password.value);
            }
        } catch {
            // El error ya se setea en loginError desde useAuth
        }
    };

    const handleForgotPassword = async () => {
        if (!email.trim()) {
            setLoginError('Escribí tu correo antes de recuperar la contraseña.');
            return;
        }
        setIsSendingReset(true);
        setLoginError('');
        setResetSuccessMsg('');
        try {
            await resetPassword(email.trim());
            // Mostramos el éxito inline — showNotification no funciona acá porque
            // el toast vive en App.jsx que no está en el árbol de render en este punto.
            setResetSuccessMsg('📧 Correo enviado. Revisá tu bandeja y el spam.');
        } catch (err) {
            setLoginError(err.message);
        } finally {
            setIsSendingReset(false);
        }
    };

    return (
        <div className="min-h-screen login-bg flex items-center justify-center p-4">
            <div className="w-full max-w-sm">

                {/* Logo y nombre de tienda */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto mb-4 ring-2 ring-orange-500/30 flex items-center justify-center bg-orange-500/20">
                        {storeProfile.logoUrl
                            ? <img src={storeProfile.logoUrl} className="w-full h-full object-cover" alt="logo" />
                            : <Store size={32} className="text-orange-400" />}
                    </div>
                    <h1 className="text-white text-2xl font-black">{storeProfile.name}</h1>
                    <p className="text-white/40 text-sm mt-1">
                        {isRegistering ? 'Crear cuenta' : 'Iniciá sesión para continuar'}
                    </p>
                </div>

                {/* Formulario */}
                <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-6 border border-white/15 shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-3">
                        {isRegistering && (
                            <>
                                <input
                                    name="name" required
                                    autoComplete="name"
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 outline-none focus:border-orange-400 transition-colors text-sm"
                                    placeholder="Nombre completo"
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <input
                                        name="phone" required
                                        autoComplete="tel"
                                        className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 outline-none focus:border-orange-400 transition-colors text-sm"
                                        placeholder="Teléfono"
                                    />
                                    <input
                                        name="address" required
                                        autoComplete="street-address"
                                        className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 outline-none focus:border-orange-400 transition-colors text-sm"
                                        placeholder="Dirección"
                                    />
                                </div>
                                <input
                                    name="inviteCode" required
                                    autoComplete="off"
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 outline-none focus:border-orange-400 transition-colors text-sm font-bold text-center uppercase tracking-widest"
                                    placeholder="CÓDIGO DE INVITACIÓN"
                                />
                            </>
                        )}

                        <input
                            name="email" type="email" required
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 outline-none focus:border-orange-400 transition-colors text-sm"
                            placeholder="Correo electrónico"
                        />
                        <input
                            name="password" type="password" required
                            autoComplete={isRegistering ? 'new-password' : 'current-password'}
                            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 outline-none focus:border-orange-400 transition-colors text-sm"
                            placeholder="Contraseña"
                        />

                        {loginError && (
                            <div className="text-red-400 text-xs text-center font-medium py-1">
                                {loginError}
                            </div>
                        )}

                        {resetSuccessMsg && (
                            <div className="text-emerald-400 text-xs text-center font-medium py-2 px-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                                {resetSuccessMsg}
                            </div>
                        )}

                        <button type="submit" className="w-full py-3.5 rounded-xl font-black text-sm btn-accent mt-1">
                            {isRegistering ? 'Crear cuenta' : 'Ingresar'}
                        </button>
                    </form>

                    <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-white/10" />
                        <span className="text-white/20 text-xs">o</span>
                        <div className="flex-1 h-px bg-white/10" />
                    </div>

                    <button
                        onClick={() => { setIsRegistering(!isRegistering); setLoginError(''); }}
                        className="w-full py-2.5 rounded-xl border border-white/20 text-white/60 text-sm font-semibold hover:bg-white/10 transition-colors"
                    >
                        {isRegistering ? 'Ya tengo cuenta' : 'Crear cuenta nueva'}
                    </button>

                    {!isRegistering && (
                        <button
                            onClick={handleForgotPassword}
                            disabled={isSendingReset}
                            className="w-full mt-2 text-white/30 text-xs hover:text-white/50 transition-colors disabled:opacity-50"
                        >
                            {isSendingReset ? 'Enviando...' : 'Olvidé mi contraseña'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
