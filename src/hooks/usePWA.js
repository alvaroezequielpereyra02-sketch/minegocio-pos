import { useState, useEffect } from 'react';

export const usePWA = () => {
    const [supportsPWA, setSupportsPWA] = useState(false);
    const [promptInstall, setPromptInstall] = useState(null);
    const [updateAvailable, setUpdateAvailable] = useState(false);

    useEffect(() => {
        // ── Botón instalar ────────────────────────────────────────────────────
        const handler = (e) => {
            e.preventDefault();
            setPromptInstall(e);
            setSupportsPWA(true);
        };
        window.addEventListener('beforeinstallprompt', handler);

        // ── Auto-update: escucha el mensaje del SW cuando hay nueva versión ──
        // El SW manda SW_UPDATED después de activarse y borrar los cachés viejos.
        // Esperamos 1.5s para que el SW termine de cachear los nuevos assets
        // antes de recargar, evitando que la app quede a mitad de actualización.
        const handleSWMessage = (event) => {
            if (event.data?.type === 'SW_UPDATED') {
                console.log('[PWA] Nueva versión detectada:', event.data.version, '— recargando...');
                setUpdateAvailable(true);
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            }
        };
        navigator.serviceWorker?.addEventListener('message', handleSWMessage);

        // ── Polling de actualización del SW (cada 60s cuando la app está abierta) ──
        // Fuerza al browser a verificar si el SW cambió en el servidor.
        // Sin esto, Chrome solo chequea cada 24h.
        let pollInterval = null;
        if ('serviceWorker' in navigator) {
            pollInterval = setInterval(async () => {
                try {
                    const reg = await navigator.serviceWorker.getRegistration();
                    if (reg) {
                        await reg.update();
                    }
                } catch (e) {
                    // Silencioso — puede fallar offline, no es crítico
                }
            }, 60 * 1000); // cada 60 segundos
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
            if (pollInterval) clearInterval(pollInterval);
        };
    }, []);

    const installApp = (evt) => {
        evt.preventDefault();
        if (!promptInstall) return;
        promptInstall.prompt();
        promptInstall.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') setSupportsPWA(false);
            setPromptInstall(null);
        });
    };

    return { supportsPWA, installApp, updateAvailable };
};
