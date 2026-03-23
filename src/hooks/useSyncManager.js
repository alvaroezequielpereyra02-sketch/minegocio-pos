/**
 * useSyncManager
 * Gestiona la cola offline de boletas. Vive en App.jsx para tener
 * acceso garantizado a createTransaction cuando Firebase ya está listo.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { serverTimestamp } from 'firebase/firestore';

export const OFFLINE_QUEUE_KEY = 'minegocio_offline_queue';

// ── Helpers de cola (compartidos con useCheckout) ─────────────────────────────
export const getOfflineQueue = () => {
    try { return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]'); }
    catch { return []; }
};
export const addToOfflineQueue = (entry) => {
    const q = getOfflineQueue(); q.push(entry);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(q));
};
const removeFromOfflineQueue = (id) => {
    localStorage.setItem(OFFLINE_QUEUE_KEY,
        JSON.stringify(getOfflineQueue().filter(e => e.localId !== id)));
};

/**
 * Ping real en 1.5 s.
 * navigator.onLine miente en Android con WiFi sin internet real.
 * Usamos google.com/generate_204 (responde en ~50ms si hay red).
 */
/**
 * checkRealInternet
 * En PC/desktop: navigator.onLine es confiable → respuesta instantánea.
 * En Android:    navigator.onLine miente con WiFi sin internet real →
 *                hacemos un ping real a Google para confirmar.
 */
const isAndroid = () => /android/i.test(navigator.userAgent);

export const checkRealInternet = () => {
    // Chequeo base: si el navegador dice offline, confiamos siempre
    if (!navigator.onLine) return Promise.resolve(false);

    // En desktop navigator.onLine es suficiente — evitamos el ping
    // que puede ser bloqueado por antivirus, VPN o firewall corporativo
    if (!isAndroid()) return Promise.resolve(true);

    // En Android: ping real para detectar WiFi sin internet
    return new Promise(resolve => {
        const ctrl = new AbortController();
        const t = setTimeout(() => { ctrl.abort(); resolve(false); }, 3000);
        fetch('https://www.google.com/generate_204', {
            method: 'HEAD', mode: 'no-cors', cache: 'no-store', signal: ctrl.signal
        })
        .then(() => { clearTimeout(t); resolve(true); })
        .catch(() => { clearTimeout(t); resolve(false); });
    });
};

// ── Hook ──────────────────────────────────────────────────────────────────────
export const useSyncManager = ({ user, createTransaction, showNotification }) => {
    const [isSyncing, setIsSyncing]       = useState(false);
    const [pendingCount, setPendingCount] = useState(() => getOfflineQueue().length);

    // Refs sincrónicos — siempre tienen el valor más reciente
    const createRef      = useRef(createTransaction);
    const notifyRef      = useRef(showNotification);
    createRef.current    = createTransaction;
    notifyRef.current    = showNotification;

    const syncQueue = useCallback(async () => {
        const queue = getOfflineQueue();
        if (queue.length === 0) { setPendingCount(0); return; }

        // Verificar conexión real antes de intentar subir
        const online = await checkRealInternet();
        if (!online) return;

        setIsSyncing(true);
        notifyRef.current(`🔄 Sincronizando ${queue.length} boleta(s)...`);

        let ok = 0;
        for (const entry of queue) {
            try {
                await createRef.current(
                    { ...entry.saleData, date: serverTimestamp() },
                    entry.itemsWithCost
                );
                removeFromOfflineQueue(entry.localId);
                ok++;
            } catch (e) {
                console.error('[SyncManager] fallo en boleta:', entry.localId, e.message);
            }
        }

        const remaining = getOfflineQueue().length;
        setPendingCount(remaining);
        setIsSyncing(false);

        if (ok > 0) notifyRef.current(`✅ ${ok} boleta(s) sincronizada(s).`);
        if (remaining > 0) notifyRef.current(`⚠️ ${remaining} boleta(s) pendientes. Reintentará al reconectarse.`);
    }, []); // estable — usa refs

    // Al autenticarse: espera 2.5 s (Firestore init) y sincroniza si hay cola
    useEffect(() => {
        if (!user?.uid) return;
        if (getOfflineQueue().length === 0) return;
        const t = setTimeout(syncQueue, 2500);
        return () => clearTimeout(t);
    }, [user?.uid, syncQueue]);

    // Al recuperar conexión
    useEffect(() => {
        const h = () => syncQueue();
        window.addEventListener('online', h);
        return () => window.removeEventListener('online', h);
    }, [syncQueue]);

    return { isSyncing, pendingCount, syncQueue, setPendingCount };
};
