import React, { useState } from 'react';
import { Store } from 'lucide-react';

/**
 * CompleteProfileScreen
 *
 * Se muestra una sola vez, justo después del primer login de un cliente
 * nuevo con Google. Pide los datos obligatorios para poder comprar: nombre,
 * dirección y teléfono. El nombre del negocio es opcional (no todo cliente
 * que compra al por mayor tiene un local propio).
 *
 * Una vez enviado, profileComplete pasa a true en el backend y esta
 * pantalla no vuelve a aparecer para ese usuario.
 */
export default function CompleteProfileScreen({ storeProfile, user, userData, completeProfile, logout }) {
    const [name, setName]                 = useState(userData?.name || user?.name || '');
    const [businessName, setBusinessName] = useState('');
    const [address, setAddress]           = useState('');
    const [phone, setPhone]               = useState('');
    const [error, setError]               = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        try {
            await completeProfile({ name, businessName, address, phone });
        } catch (err) {
            setError(err.message || 'No se pudo guardar el perfil. Probá de nuevo.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="min-h-screen login-bg flex items-center justify-center p-4" aria-label="Completar perfil">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto mb-4 ring-2 ring-orange-500/30 flex items-center justify-center bg-orange-500/20">
                        {storeProfile?.logoUrl
                            ? <img src={storeProfile.logoUrl} className="w-full h-full object-cover" alt="logo" />
                            : <Store size={32} className="text-orange-400" />}
                    </div>
                    <h1 className="text-white text-2xl font-black">¡Ya casi!</h1>
                    <p className="text-white/40 text-sm mt-1">
                        Necesitamos estos datos para poder recibir tus pedidos
                    </p>
                </div>

                <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-6 border border-white/15 shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <input
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoComplete="name"
                            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 outline-none focus:border-orange-400 transition-colors text-sm"
                            placeholder="Nombre completo"
                        />
                        <input
                            value={businessName}
                            onChange={(e) => setBusinessName(e.target.value)}
                            autoComplete="organization"
                            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 outline-none focus:border-orange-400 transition-colors text-sm"
                            placeholder="Nombre del negocio (opcional)"
                        />
                        <input
                            required
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            autoComplete="street-address"
                            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 outline-none focus:border-orange-400 transition-colors text-sm"
                            placeholder="Dirección de entrega"
                        />
                        <input
                            required
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            autoComplete="tel"
                            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 outline-none focus:border-orange-400 transition-colors text-sm"
                            placeholder="Teléfono"
                        />

                        {error && (
                            <div className="text-red-400 text-xs text-center font-medium py-1">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-3.5 rounded-xl font-black text-sm btn-accent mt-1 disabled:opacity-50"
                        >
                            {isSubmitting ? 'Guardando…' : 'Continuar'}
                        </button>
                    </form>

                    <button
                        onClick={logout}
                        className="w-full mt-4 text-white/30 text-xs hover:text-white/50 transition-colors"
                    >
                        Cerrar sesión
                    </button>
                </div>
            </div>
        </main>
    );
}
