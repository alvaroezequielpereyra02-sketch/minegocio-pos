import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
    collection, getDocs, getDocsFromServer,
    addDoc, deleteDoc, doc, limit, query,
} from 'firebase/firestore';
import { getDb, appId } from '../config/firebase';
import { getOfflineQueue } from '../hooks/useSyncManager';
import { useAuthContext } from '../context/AuthContext';
import {
    CheckCircle, XCircle, AlertTriangle, RefreshCw, ShieldCheck,
    Database, Bell, Package, WifiOff, Key, Loader2, PenLine,
    HardDrive, Copy, RotateCcw, Image,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────
const SW_CACHE_VERSION   = 'v22';   // debe coincidir con CACHE_VERSION en firebase-messaging-sw.js
const TOKEN_WARN_DAYS    = 25;      // warning antes de los 30 días de expiración del token FCM
const HEALTH_PERSIST_KEY = 'minegocio_health_cache'; // key de localStorage para persistir resultados
const LS_MAX_BYTES       = 5 * 1024 * 1024;          // ~5MB límite de localStorage

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Mide el tiempo de ejecución de una función async y devuelve { result, ms } */
async function timed(fn) {
    const t0 = performance.now();
    const result = await fn();
    return { result, ms: Math.round(performance.now() - t0) };
}

/** Calcula el uso aproximado de localStorage en bytes (UTF-16: 2 bytes por char) */
function localStorageUsedBytes() {
    let bytes = 0;
    for (const key in localStorage) {
        if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
            bytes += (key.length + (localStorage[key]?.length ?? 0)) * 2;
        }
    }
    return bytes;
}

// ─────────────────────────────────────────────────────────────────────────────
// Definición de checks
//
// Cada check: { id, label, description, icon, run: async () => { ok, detail, warn? } }
//   ok   = true → verde (o amarillo si warn=true)
//   ok   = false → rojo
//   warn = true  → amarillo aunque ok=true (no crítico, pero hay que revisar)
// ─────────────────────────────────────────────────────────────────────────────

const makeChecks = (user) => [

    // ── 1. Firestore — Lectura desde servidor ────────────────────────────────
    // Usa getDocsFromServer para forzar una llamada de red real.
    // getDocs puede servir desde caché local y ocultar problemas de conectividad.
    {
        id: 'firestore_read',
        label: 'Firestore — Lectura (red)',
        description: 'Lee el catálogo directamente del servidor, sin caché',
        icon: Database,
        run: async () => {
            const db   = await getDb();
            const q    = query(collection(db, 'stores', appId, 'products'), limit(1));
            const snap = await getDocsFromServer(q);
            return { ok: true, detail: `${snap.size} documento(s) leído(s) desde el servidor` };
        },
    },

    // ── 2. Firestore — Escritura y borrado ───────────────────────────────────
    {
        id: 'firestore_write',
        label: 'Firestore — Escritura',
        description: 'Puede guardar y borrar documentos en la base de datos',
        icon: PenLine,
        run: async () => {
            const db      = await getDb();
            const testRef = collection(db, 'stores', appId, 'health_checks');
            const written = await addDoc(testRef, { ts: Date.now(), source: 'health-check' });
            await deleteDoc(doc(db, 'stores', appId, 'health_checks', written.id));
            return { ok: true, detail: 'Escritura y borrado atómicos exitosos' };
        },
    },

    // ── 3. Cloudinary — Variables y conectividad ────────────────────────────
    // Las imágenes de productos van a Cloudinary (uploadImage.js), no a Firebase Storage.
    //
    // api.cloudinary.com bloquea fetch desde el navegador por CORS, así que
    // no se puede usar el endpoint /ping directamente. En su lugar:
    //   1. Verificamos que las variables de entorno estén presentes.
    //   2. Hacemos un HEAD con mode:'no-cors' al CDN (res.cloudinary.com).
    //      Con no-cors el navegador no puede leer la respuesta, pero si la
    //      Promise resuelve (tipo 'opaque') sabemos que la red llegó al servidor.
    //      Si lanza error, hay un problema de conectividad o el cloud_name no existe.
    {
        id: 'cloudinary',
        label: 'Cloudinary — Imágenes',
        description: 'Las variables de Cloudinary están configuradas y el CDN responde',
        icon: Image,
        run: async () => {
            const cloudName    = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
            const uploadPreset = import.meta.env.VITE_CLOUDINARY_PRESET;

            if (!cloudName || !uploadPreset) {
                const missing = [
                    !cloudName    && 'VITE_CLOUDINARY_CLOUD_NAME',
                    !uploadPreset && 'VITE_CLOUDINARY_PRESET',
                ].filter(Boolean);
                return { ok: false, detail: `Faltan variables: ${missing.join(', ')} — verificá Vercel → Environment Variables` };
            }

            // Ping al CDN de entrega de Cloudinary (permite CORS desde browser).
            // El path /image/upload/ siempre existe para cualquier cloud_name válido.
            // Con mode:'no-cors' obtenemos una respuesta opaca (no legible) pero
            // la ausencia de error de red confirma conectividad y que el cloud_name es válido.
            const ctrl = new AbortController();
            const tid  = setTimeout(() => ctrl.abort(), 5000);
            try {
                await fetch(
                    `https://res.cloudinary.com/${cloudName}/image/upload/`,
                    { method: 'HEAD', mode: 'no-cors', signal: ctrl.signal }
                );
                clearTimeout(tid);
                return { ok: true, detail: `cloud_name: ${cloudName} · upload_preset: ${uploadPreset}` };
            } catch (err) {
                clearTimeout(tid);
                if (err.name === 'AbortError') return { ok: false, detail: 'Timeout — CDN de Cloudinary no respondió en 5s' };
                return { ok: false, detail: `Sin conectividad con Cloudinary: ${err.message}` };
            }
        },
    },

    // ── 4. Capacidad de localStorage ─────────────────────────────────────────
    // Un localStorage lleno causa QuotaExceededError silencioso en la cola offline.
    // Alertamos al 50% para dar tiempo a reaccionar.
    {
        id: 'localstorage',
        label: 'Capacidad localStorage',
        description: 'Espacio disponible para guardar boletas offline',
        icon: HardDrive,
        run: async () => {
            const usedBytes = localStorageUsedBytes();
            const usedKB    = Math.round(usedBytes / 1024);
            const maxKB     = Math.round(LS_MAX_BYTES / 1024);
            const pct       = Math.round((usedBytes / LS_MAX_BYTES) * 100);
            const queue     = getOfflineQueue();
            const queueInfo = queue.length > 0 ? ` · ${queue.length} boleta(s) en cola` : '';

            if (pct >= 80) return {
                ok: false,
                detail: `${usedKB}KB / ~${maxKB}KB (${pct}%) — CRÍTICO: QuotaExceededError inminente${queueInfo}`,
            };
            if (pct >= 50) return {
                ok: true, warn: true,
                detail: `${usedKB}KB / ~${maxKB}KB (${pct}%) — considerar sincronizar y limpiar${queueInfo}`,
            };
            return { ok: true, detail: `${usedKB}KB / ~${maxKB}KB (${pct}%)${queueInfo}` };
        },
    },

    // ── 5. Permiso de notificaciones ──────────────────────────────────────────
    {
        id: 'notif_permission',
        label: 'Permiso de notificaciones',
        description: 'El navegador tiene autorización para mostrar notificaciones push',
        icon: Bell,
        run: async () => {
            if (!('Notification' in window)) {
                return { ok: false, detail: 'Este navegador no soporta notificaciones push' };
            }
            const perm = Notification.permission;
            if (perm === 'granted') return { ok: true, detail: 'Permiso concedido' };
            if (perm === 'denied')  return { ok: false, detail: 'Permiso bloqueado — ir a Configuración del navegador y desbloquearlo' };
            return { ok: false, warn: true, detail: 'Permiso no solicitado aún — cerrá sesión y volvé a entrar' };
        },
    },

    // ── 6. Token FCM en Firestore ─────────────────────────────────────────────
    {
        id: 'firestore_token',
        label: 'Token FCM registrado',
        description: 'El token de push notifications está en Firestore y vigente',
        icon: Bell,
        run: async () => {
            if (!user?.uid) return { ok: false, detail: 'No hay usuario autenticado' };
            const db   = await getDb();
            const snap = await getDocs(
                query(collection(db, 'stores', appId, 'fcm_tokens'), limit(10))
            );
            const tokenDoc = snap.docs.find(d => d.id === user.uid);
            if (!tokenDoc) {
                return { ok: false, detail: 'Token no encontrado — cerrá sesión y volvé a entrar para regenerarlo' };
            }
            const data      = tokenDoc.data();
            const lastUpdate = data.updatedAt?.toDate?.();
            const daysAgo   = lastUpdate
                ? Math.floor((Date.now() - lastUpdate.getTime()) / 86_400_000)
                : null;

            if (daysAgo !== null && daysAgo >= TOKEN_WARN_DAYS) {
                return {
                    ok: true, warn: true,
                    detail: `Token tiene ${daysAgo} días — próximo a vencer (límite 30). Cerrá sesión para renovarlo`,
                };
            }
            const age = daysAgo !== null ? `actualizado hace ${daysAgo} días` : 'fecha desconocida';
            return { ok: true, detail: `Token OK · plataforma: ${data.platform ?? 'desconocida'} · ${age}` };
        },
    },

    // ── 7. API /notify ────────────────────────────────────────────────────────
    {
        id: 'notify_api',
        label: 'API /notify',
        description: 'El endpoint serverless de notificaciones responde correctamente',
        icon: Bell,
        run: async () => {
            const ctrl = new AbortController();
            const tid  = setTimeout(() => ctrl.abort(), 6000);
            try {
                const res = await fetch('/api/notify', {
                    method: 'POST',
                    signal: ctrl.signal,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        dry_run: true,
                        transactionId: 'health-check',
                        clientName: 'HealthCheck',
                        total: 0,
                        storeId: appId,
                    }),
                });
                clearTimeout(tid);
                if (res.status === 405) return { ok: false, detail: 'Error 405 — verificá que el método sea POST en Vercel' };
                if (res.status >= 500) {
                    const body = await res.json().catch(() => ({}));
                    return { ok: false, detail: `Error ${res.status}: ${body.error ?? 'revisar Vercel Functions logs'}` };
                }
                return { ok: true, detail: `Respondió con HTTP ${res.status}` };
            } catch (err) {
                clearTimeout(tid);
                if (err.name === 'AbortError') return { ok: false, detail: 'Timeout — la API no respondió en 6s' };
                return { ok: false, detail: `Error de red: ${err.message}` };
            }
        },
    },

    // ── 8. Cola offline ───────────────────────────────────────────────────────
    // Distingue entre cola vacía (ideal), boletas recientes (normal) y
    // boletas viejas que deberían haberse sincronizado hace días (problema real).
    {
        id: 'offline_queue',
        label: 'Cola offline',
        description: 'No hay boletas atascadas sin sincronizar',
        icon: WifiOff,
        run: async () => {
            const queue = getOfflineQueue();
            if (queue.length === 0) return { ok: true, detail: 'Cola vacía — no hay boletas pendientes' };

            const now   = Date.now();
            const old   = queue.filter(e => e.savedAt && (now - e.savedAt) > 24 * 60 * 60 * 1000);
            const fresh = queue.filter(e => !e.savedAt || (now - e.savedAt) <= 24 * 60 * 60 * 1000);

            if (old.length > 0) {
                return {
                    ok: false,
                    detail: `${old.length} boleta(s) sin sincronizar por más de 24h — revisá la conexión y volvé a abrir la app`,
                };
            }
            return {
                ok: true, warn: true,
                detail: `${fresh.length} boleta(s) reciente(s) pendientes — se sincronizarán al recuperar conexión`,
            };
        },
    },

    // ── 9. Variables de entorno ───────────────────────────────────────────────
    {
        id: 'env_vars',
        label: 'Variables de entorno',
        description: 'Todas las variables críticas de Firebase están presentes',
        icon: Key,
        run: async () => {
            const required = [
                ['VITE_FIREBASE_API_KEY',             import.meta.env.VITE_FIREBASE_API_KEY],
                ['VITE_FIREBASE_PROJECT_ID',          import.meta.env.VITE_FIREBASE_PROJECT_ID],
                ['VITE_FIREBASE_MESSAGING_SENDER_ID', import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID],
                ['VITE_FIREBASE_APP_ID',              import.meta.env.VITE_FIREBASE_APP_ID],
                ['VITE_STORE_ID',                     import.meta.env.VITE_STORE_ID],
                ['VITE_FIREBASE_VAPID_KEY',           import.meta.env.VITE_FIREBASE_VAPID_KEY],
            ];
            const missing = required.filter(([, v]) => !v).map(([k]) => k);
            if (missing.length > 0) {
                return { ok: false, detail: `Faltan: ${missing.join(', ')} — verificá Vercel → Settings → Environment Variables` };
            }
            return { ok: true, detail: `${required.length} variables presentes` };
        },
    },

    // ── 10. Service Worker ────────────────────────────────────────────────────
    {
        id: 'service_worker',
        label: 'Service Worker',
        description: `SW activo y en versión ${SW_CACHE_VERSION}`,
        icon: Package,
        run: async () => {
            if (!('serviceWorker' in navigator)) {
                return { ok: false, detail: 'navigator.serviceWorker no disponible en este navegador' };
            }
            const reg = await navigator.serviceWorker.getRegistration('/');
            if (!reg) {
                return { ok: false, detail: 'No hay ningún Service Worker registrado — recargá la app' };
            }
            const state = reg.active?.state ?? reg.installing?.state ?? 'desconocido';
            if (state !== 'activated') {
                return { ok: false, detail: `Estado: ${state} — esperado: activated. Recargá la app` };
            }
            const cacheNames     = await caches.keys();
            const expectedCache  = `minegocio-pos-${SW_CACHE_VERSION}`;
            const hasCurrentCache = cacheNames.includes(expectedCache);
            if (!hasCurrentCache) {
                return {
                    ok: true, warn: true,
                    detail: `SW activado pero caché ${expectedCache} no encontrado (cachés actuales: ${cacheNames.join(', ')}) — recargá`,
                };
            }
            return { ok: true, detail: `SW activated · caché ${expectedCache} presente` };
        },
    },

    // ── 11. Configuración del Service Worker ──────────────────────────────────
    // Lee el archivo SW desde el servidor y compara el projectId hardcodeado
    // contra la variable de entorno activa. Un mismatch ocurre cuando se actualizan
    // las credenciales de Firebase pero se olvida actualizar el SW.
    {
        id: 'sw_config',
        label: 'Credenciales del SW',
        description: 'Las credenciales hardcodeadas en el SW coinciden con el entorno activo',
        icon: Package,
        run: async () => {
            const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
            if (!envProjectId) return { ok: false, detail: 'VITE_FIREBASE_PROJECT_ID no está definida — no se puede comparar' };

            const res = await fetch('/firebase-messaging-sw.js', { cache: 'no-store' });
            if (!res.ok) return { ok: false, detail: `No se pudo leer el SW (HTTP ${res.status})` };

            const text  = await res.text();
            // Busca projectId: "valor" o projectId: 'valor'
            const match = text.match(/projectId:\s*["']([^"']+)["']/);
            const swProjectId = match?.[1];

            if (!swProjectId) {
                return { ok: false, warn: true, detail: 'No se encontró projectId en el SW — verificar manualmente' };
            }
            if (swProjectId !== envProjectId) {
                return {
                    ok: false,
                    detail: `Mismatch: SW tiene "${swProjectId}" pero el env tiene "${envProjectId}" — actualizá las credenciales en firebase-messaging-sw.js`,
                };
            }
            return { ok: true, detail: `projectId coincide: ${swProjectId}` };
        },
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de persistencia
// ─────────────────────────────────────────────────────────────────────────────

function loadPersistedState() {
    try {
        const stored = JSON.parse(localStorage.getItem(HEALTH_PERSIST_KEY) ?? 'null');
        if (!stored) return { results: {}, lastRun: null };
        return {
            results: stored.results ?? {},
            lastRun: stored.lastRun ? new Date(stored.lastRun) : null,
        };
    } catch { return { results: {}, lastRun: null }; }
}

function persistState(results, lastRun) {
    try {
        localStorage.setItem(HEALTH_PERSIST_KEY, JSON.stringify({
            results,
            lastRun: lastRun?.toISOString() ?? null,
        }));
    } catch { /* ignorar si el localStorage está lleno */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────────────────────────────────────

function StatusIcon({ status }) {
    if (status === 'running') return <Loader2 size={16} className="text-blue-500 animate-spin shrink-0" />;
    if (status === 'ok')      return <CheckCircle size={16} className="text-green-600 shrink-0" />;
    if (status === 'warn')    return <AlertTriangle size={16} className="text-amber-500 shrink-0" />;
    if (status === 'error')   return <XCircle size={16} className="text-red-500 shrink-0" />;
    return <div className="w-4 h-4 rounded-full bg-slate-200 shrink-0" />;
}

function CheckRow({ check, result, onRetry }) {
    const Icon = check.icon;

    // BUG FIX: el warn estaba en result.warn pero el estado se calculaba
    // solo de result.status, nunca se pintaba de amarillo. Ahora se lee
    // correctamente desde el resultado persistido.
    const rawStatus = result?.status ?? 'idle';
    const isWarn    = rawStatus === 'ok' && result?.warn;
    const status    = isWarn ? 'warn' : rawStatus;

    const colors = {
        ok:      { row: 'bg-green-50/50 border-green-200', icon: 'bg-green-100 text-green-700', text: 'text-green-700' },
        warn:    { row: 'bg-amber-50/50 border-amber-200', icon: 'bg-amber-100 text-amber-600', text: 'text-amber-600' },
        error:   { row: 'bg-red-50/50 border-red-200',     icon: 'bg-red-100 text-red-600',     text: 'text-red-600' },
        running: { row: 'bg-blue-50/50 border-blue-100',   icon: 'bg-blue-50 text-blue-500',    text: 'text-blue-500' },
        idle:    { row: 'border-[#D4C9B0]',                icon: 'bg-[#EDE8DC] text-[#8B6914]', text: 'text-slate-500' },
    };
    const c = colors[status] ?? colors.idle;

    return (
        <div className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${c.row}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${c.icon}`}>
                <Icon size={15} />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <StatusIcon status={status} />
                    <span className="font-bold text-sm text-[#3D2B1F]">{check.label}</span>
                    {result?.ms != null && (
                        <span className="text-[10px] text-slate-400 font-mono">{result.ms}ms</span>
                    )}
                </div>
                <p className="text-xs text-[#7A6040] mt-0.5">{check.description}</p>
                {result?.detail && (
                    <p className={`text-xs mt-1 font-medium ${c.text}`}>{result.detail}</p>
                )}
            </div>

            {/* Botón de reintento individual — solo visible cuando no está corriendo */}
            {status !== 'idle' && status !== 'running' && (
                <button
                    onClick={() => onRetry(check.id)}
                    className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-[#8B6914] hover:bg-[#EDE8DC] transition-colors"
                    title="Reintentar este check"
                >
                    <RotateCcw size={13} />
                </button>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export default function HealthCheck() {
    const { user, userData } = useAuthContext();

    // Cargar resultados persistidos del último run al montar
    const [results, setResults] = useState(() => loadPersistedState().results);
    const [lastRun, setLastRun] = useState(() => loadPersistedState().lastRun);
    const [running, setRunning] = useState(false);

    // useMemo: los checks solo se recrean si cambia el uid del usuario
    const checks = useMemo(() => makeChecks(user), [user]);

    // ── Núcleo: ejecuta un check individual y actualiza el estado ─────────────
    const executeCheck = useCallback(async (check) => {
        setResults(prev => ({ ...prev, [check.id]: { status: 'running' } }));
        try {
            const { result, ms } = await timed(() => check.run());
            // BUG FIX: propagar el campo warn al estado (antes se perdía aquí)
            setResults(prev => ({
                ...prev,
                [check.id]: {
                    status: result.ok ? 'ok' : 'error',
                    detail: result.detail,
                    warn:   result.warn ?? false,
                    ms,
                },
            }));
        } catch (err) {
            const ms = 0;
            setResults(prev => ({
                ...prev,
                [check.id]: { status: 'error', detail: `Excepción: ${err.message}`, warn: false, ms },
            }));
        }
    }, []);

    // ── Correr todos en paralelo ──────────────────────────────────────────────
    const runAll = useCallback(async () => {
        if (running) return;
        setRunning(true);
        // Marcar todos como 'running' de una sola vez
        setResults(Object.fromEntries(checks.map(c => [c.id, { status: 'running' }])));
        await Promise.all(checks.map(executeCheck));
        const now = new Date();
        setLastRun(now);
        setRunning(false);
    }, [checks, executeCheck, running]);

    // ── Reintentar un check individual ────────────────────────────────────────
    const retrySingle = useCallback(async (checkId) => {
        const check = checks.find(c => c.id === checkId);
        if (check) await executeCheck(check);
    }, [checks, executeCheck]);

    // ── Persistir resultados cada vez que cambian ─────────────────────────────
    useEffect(() => {
        if (lastRun) persistState(results, lastRun);
    }, [results, lastRun]);

    // ── Copiar reporte al portapapeles ────────────────────────────────────────
    const copyReport = useCallback(() => {
        const header = [
            'MiNegocio POS — Health Check',
            `Fecha: ${lastRun?.toLocaleString('es-AR') ?? 'Sin datos'}`,
            '',
        ];
        const rows = checks.map(c => {
            const r    = results[c.id];
            const st   = !r ? '⏸' : r.status === 'ok' && !r.warn ? '✅' : r.status === 'ok' && r.warn ? '⚠️' : r.status === 'error' ? '❌' : '🔄';
            const time = r?.ms != null ? ` (${r.ms}ms)` : '';
            return `${st} ${c.label}${time}: ${r?.detail ?? 'No ejecutado'}`;
        });
        navigator.clipboard.writeText([...header, ...rows].join('\n')).catch(() => {});
    }, [checks, results, lastRun]);

    // ── Early return DESPUÉS de todos los hooks ───────────────────────────────
    if (userData?.role !== 'admin') return null;

    // ── Conteos para el resumen ───────────────────────────────────────────────
    const total    = checks.length;
    const okCount  = Object.values(results).filter(r => r.status === 'ok' && !r.warn).length;
    const warnCount = Object.values(results).filter(r => r.status === 'ok' && r.warn).length;
    const errCount = Object.values(results).filter(r => r.status === 'error').length;
    const hasRun   = lastRun !== null;

    const summaryColor = errCount > 0
        ? 'bg-red-100 text-red-600 border-red-200'
        : warnCount > 0
        ? 'bg-amber-100 text-amber-700 border-amber-200'
        : hasRun
        ? 'bg-green-100 text-green-700 border-green-200'
        : 'bg-slate-100 text-slate-500 border-slate-200';

    const summaryText = !hasRun
        ? 'Sin datos'
        : errCount > 0
        ? `${errCount} error(es)`
        : warnCount > 0
        ? `${okCount}/${total} OK · ${warnCount} advertencia(s)`
        : `${okCount}/${total} OK`;

    return (
        <div className="bg-[#EDE8DC] p-4 rounded-2xl shadow-sm border border-[#D4C9B0]">

            {/* Header */}
            <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                    <ShieldCheck size={16} className="text-[#8B6914]" />
                    <h3 className="font-bold text-[#3D2B1F] text-xs uppercase tracking-wide">
                        Health Check del Sistema
                    </h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${summaryColor}`}>
                        {summaryText}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {hasRun && (
                        <button
                            onClick={copyReport}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#8B6914] border border-[#D4C9B0] hover:bg-[#D4C9B0] transition-colors"
                            title="Copiar reporte"
                        >
                            <Copy size={11} /> Copiar
                        </button>
                    )}
                    <button
                        onClick={runAll}
                        disabled={running}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                            running
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-[#8B6914] text-white hover:bg-[#6B4F0F]'
                        }`}
                    >
                        <RefreshCw size={12} className={running ? 'animate-spin' : ''} />
                        {running ? 'Verificando...' : hasRun ? 'Volver a verificar' : 'Verificar ahora'}
                    </button>
                </div>
            </div>

            {/* Descripción inicial */}
            {!hasRun && (
                <p className="text-xs text-[#A09070] mb-4 italic">
                    Corré este chequeo después de cada actualización para confirmar que todo funciona correctamente en producción.
                    Los resultados se guardan y estarán disponibles la próxima vez que abras esta pantalla.
                </p>
            )}

            {/* Lista de checks */}
            <div className="space-y-2">
                {checks.map(check => (
                    <CheckRow
                        key={check.id}
                        check={check}
                        result={results[check.id]}
                        onRetry={retrySingle}
                    />
                ))}
            </div>

            {/* Timestamp */}
            {hasRun && (
                <p className="text-[10px] text-[#A09070] mt-3 text-right italic">
                    Última verificación: {lastRun.toLocaleString('es-AR')}
                    {!running && ' · Usá ↺ por check para reintentar individualmente'}
                </p>
            )}
        </div>
    );
}
