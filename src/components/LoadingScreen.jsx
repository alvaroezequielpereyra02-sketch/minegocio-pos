import React from 'react';
import { Store } from 'lucide-react';

/**
 * LoadingScreen
 * Se muestra mientras Firebase inicializa la sesión (authLoading = true).
 */
export default function LoadingScreen({ storeProfile, isOnline }) {
    return (
        <div className="h-screen flex flex-col items-center justify-center login-bg">
            <div className="w-12 h-12 rounded-2xl overflow-hidden ring-2 ring-orange-500/30 mb-6 flex items-center justify-center bg-orange-500/20">
                {storeProfile?.logoUrl
                    ? <img src={storeProfile.logoUrl} className="w-full h-full object-cover" alt="logo" />
                    : <Store size={24} className="text-orange-400" />}
            </div>
            <div className="flex gap-1.5 mb-3">
                {[0, 1, 2].map(i => (
                    <div
                        key={i}
                        className="w-2 h-2 rounded-full bg-orange-500 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                    />
                ))}
            </div>
            <span className="text-white/40 text-sm">Cargando...</span>
            {!isOnline && (
                <span className="text-orange-400/60 text-xs mt-2">Modo offline</span>
            )}
        </div>
    );
}
