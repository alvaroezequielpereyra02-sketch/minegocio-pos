import { useState, useEffect } from 'react';

export const usePWA = () => {
    const [supportsPWA, setSupportsPWA] = useState(false);
    const [promptInstall, setPromptInstall] = useState(null);

    useEffect(() => {
        const handler = (e) => {
            // 1. Evitar que Chrome muestre el prompt automático feo
            e.preventDefault();
            // 2. Guardar el evento para dispararlo después
            setPromptInstall(e);
            // 3. Avisar a la UI que ya podemos mostrar el botón
            setSupportsPWA(true);
        };

        // Escuchar el evento
        window.addEventListener('beforeinstallprompt', handler);

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const installApp = (evt) => {
        evt.preventDefault();
        if (!promptInstall) return;

        // Disparar el prompt nativo
        promptInstall.prompt();

        // Esperar la elección del usuario (opcional, para analíticas)
        promptInstall.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
                setSupportsPWA(false); // Ocultar botón tras instalar
            }
            setPromptInstall(null);
        });
    };

    return { supportsPWA, installApp };
};