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

    const handleSubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        try {
            if (isRegistering) {
                await register({
                    name:       form.name.value,
                    phone:      form.phone.value,
                    address:    form.address.value,
                    email:      form.email.value,
                    password:   form.password.value,
                    inviteCode: form.inviteCode?.value || '',
                });
            } else {
                await login(form.email.value, form.password.value);
            }
        } catch {
            // El error ya se setea en loginError desde useAuth
        }
    };

    const handleForgotPassword = () => {
        const emailInput = document.querySelector('input[name="email"]');
        if (!emailInput?.value) {
            setLoginError("Escribe tu correo primero.");
            return;
        }
        resetPassword(emailInput.value)
            .then(() => showNotification("📧 Correo de recuperación enviado"))
            .catch(err => setLoginError(err.message));
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
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 outline-none focus:border-orange-400 transition-colors text-sm"
                                    placeholder="Nombre completo"
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <input
                                        name="phone" required
                                        className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 outline-none focus:border-orange-400 transition-colors text-sm"
                                        placeholder="Teléfono"
                                    />
                                    <input
                                        name="address" required
                                        className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 outline-none focus:border-orange-400 transition-colors text-sm"
                                        placeholder="Dirección"
                                    />
                                </div>
                                <input
                                    name="inviteCode" required
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 outline-none focus:border-orange-400 transition-colors text-sm font-bold text-center uppercase tracking-widest"
                                    placeholder="CÓDIGO DE INVITACIÓN"
                                />
                            </>
                        )}

                        <input
                            name="email" type="email" required
                            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 outline-none focus:border-orange-400 transition-colors text-sm"
                            placeholder="Correo electrónico"
                        />
                        <input
                            name="password" type="password" required
                            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 outline-none focus:border-orange-400 transition-colors text-sm"
                            placeholder="Contraseña"
                        />

                        {loginError && (
                            <div className="text-red-400 text-xs text-center font-medium py-1">
                                {loginError}
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
                            className="w-full mt-2 text-white/30 text-xs hover:text-white/50 transition-colors"
                        >
                            Olvidé mi contraseña
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
