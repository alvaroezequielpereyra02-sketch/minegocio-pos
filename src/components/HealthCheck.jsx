import React, { useState, useCallback, useMemo } from 'react';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { db, appId } from '../config/firebase';
import { getOfflineQueue } from '../hooks/useSyncManager';
import { useAuthContext } from '../context/AuthContext';
import {
    CheckCircle, XCircle, AlertTriangle, RefreshCw, ShieldCheck,
    Database, Bell, Package, WifiOff, Key, Loader2
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Definición de checks
// Cada check es una función async que devuelve { ok, detail }
// ─────────────────────────────────────────────────────────────────────────────

const makeChecks = (user) => [
    {
        id: 'firestore_read',
        label: 'Firestore — Lectura',
        description: 'Puede leer el catálogo de productos',
        icon: Database,
        run: async () => {
            const q = query(collection(db, 'stores', appId, 'products'), limit(1));
            const snap = await getDocs(q);
            return {
                ok: true,
                detail: `OK — ${snap.size} documento(s) accesible(s)`,
            };
        },
    },
    {
        id: 'firestore_token',
        label: 'Token FCM registrado',
        description: 'El token de notificaciones push está guardado en Firestore',
        icon: Bell,
        run: async () => {
            if (!user?.uid) return { ok: false, detail: 'No hay usuario autenticado' };
            const snap = await getDocs(
                query(collection(db, 'stores', appId, 'fcm_tokens'), limit(10))
            );
            const tokenDoc = snap.docs.find(d => d.id === user.uid);
            if (!tokenDoc) {
                return {
                    ok: false,
                    detail: 'Token no encontrado — cerrá sesión y volvé a entrar para regenerarlo',
                };
            }
            const data = tokenDoc.data();
            const lastUpdate = data.updatedAt?.toDate?.();
            const daysAgo = lastUpdate
                ? Math.floor((Date.now() - lastUpdate.getTime()) / 86400000)
                : '?';
            return {
                ok: true,
                detail: `Token registrado · plataforma: ${data.platform} · actualizado hace ${daysAgo} días`,
            };
        },
    },
    {
        id: 'notify_api',
        label: 'API /notify',
        description: 'El endpoint serverless de notificaciones responde',
        icon: Bell,
        run: async () => {
            const ctrl = new AbortController();
            const tid = setTimeout(() => ctrl.abort(), 6000);
            try {
                // Enviamos dry_run=true para que el endpoint no dispare FCM real
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
                if (res.status === 405) {
                    return { ok: false, detail: 'La API respondió 405 — verificá el método POST en Vercel' };
                }
                if (res.status >= 500) {
                    const body = await res.json().catch(() => ({}));
                    return { ok: false, detail: `Error ${res.status}: ${body.error || 'Revisar Vercel Functions logs'}` };
                }
                return { ok: true, detail: `Respondió con HTTP ${res.status}` };
            } catch (err) {
                clearTimeout(tid);
                if (err.name === 'AbortError') {
                    return { ok: false, detail: 'Timeout — la API no respondió en 6s' };
                }
                return { ok: false, detail: `Error de red: ${err.message}` };
            }
        },
    },
    {
        id: 'offline_queue',
        label: 'Cola offline',
        description: 'No hay boletas atascadas sin sincronizar',
        icon: WifiOff,
        run: async () => {
            const queue = getOfflineQueue();
            if (queue.length === 0) {
                return { ok: true, detail: 'Cola vacía — no hay boletas pendientes' };
            }
            const ids = queue.map(e => e.localId).join(', ');
            return {
                ok: false,
                detail: `${queue.length} boleta(s) sin sincronizar: ${ids}`,
            };
        },
    },
    {
        id: 'env_vars',
        label: 'Variables de entorno',
        description: 'Todas las variables críticas de Firebase están cargadas',
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
                return {
                    ok: false,
                    detail: `Faltan: ${missing.join(', ')} — Verificá Vercel → Settings → Environment Variables`,
                };
            }
            return { ok: true, detail: `${required.length} variables presentes` };
        },
    },
    {
        id: 'service_worker',
        label: 'Service Worker',
        description: 'El SW de notificaciones está activo',
        icon: Package,
        run: async () => {
            if (!('serviceWorker' in navigator)) {
                return { ok: false, detail: 'Navigator.serviceWorker no disponible en este navegador' };
            }
            const reg = await navigator.serviceWorker.getRegistration('/');
            if (!reg) {
                return { ok: false, detail: 'No hay ningún Service Worker registrado — recargá la app' };
            }
            const state = reg.active?.state || reg.installing?.state || 'desconocido';
            return { ok: state === 'activated', detail: `Estado: ${state}` };
        },
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────────────────────────────────────

function StatusIcon({ status }) {
    if (status === 'running') return <Loader2 size={18} className="text-blue-500 animate-spin shrink-0" />;
    if (status === 'ok')      return <CheckCircle size={18} className="text-green-600 shrink-0" />;
    if (status === 'warn')    return <AlertTriangle size={18} className="text-amber-500 shrink-0" />;
    if (status === 'error')   return <XCircle size={18} className="text-red-500 shrink-0" />;
    return <div className="w-4 h-4 rounded-full bg-slate-200 shrink-0" />;
}

function CheckRow({ check, result }) {
    const Icon = check.icon;
    const status = result?.status || 'idle';
    const rowBg = {
        idle:    '',
        running: 'bg-blue-50/50',
        ok:      'bg-green-50/50',
        warn:    'bg-amber-50/50',
        error:   'bg-red-50/50',
    }[status];

    return (
        <div className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${rowBg} ${
            status === 'ok'    ? 'border-green-200' :
            status === 'error' ? 'border-red-200'   :
            status === 'warn'  ? 'border-amber-200' :
            'border-[#D4C9B0]'
        }`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                status === 'ok'    ? 'bg-green-100 text-green-700' :
                status === 'error' ? 'bg-red-100 text-red-600'     :
                status === 'warn'  ? 'bg-amber-100 text-amber-600' :
                'bg-[#EDE8DC] text-[#8B6914]'
            }`}>
                <Icon size={16} />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <StatusIcon status={status} />
                    <span className="font-bold text-sm text-[#3D2B1F]">{check.label}</span>
                </div>
                <p className="text-xs text-[#7A6040] mt-0.5">{check.description}</p>
                {result?.detail && (
                    <p className={`text-xs mt-1 font-medium ${
                        status === 'ok'    ? 'text-green-700' :
                        status === 'error' ? 'text-red-600'   :
                        status === 'warn'  ? 'text-amber-600' :
                        'text-slate-500'
                    }`}>
                        {result.detail}
                    </p>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export default function HealthCheck() {
    const { user, userData } = useAuthContext();
    const [results, setResults]   = useState({});
    const [running, setRunning]   = useState(false);
    const [lastRun, setLastRun]   = useState(null);

    // useMemo evita recrear los 6 objetos con sus funciones en cada render.
    // La array solo cambia si cambia el uid del usuario.
    const checks = useMemo(() => makeChecks(user), [user]);

    const runAll = useCallback(async () => {
        setRunning(true);
        setResults({});

        // Marcar todos como "corriendo"
        const initial = {};
        checks.forEach(c => { initial[c.id] = { status: 'running' }; });
        setResults(initial);

        // Ejecutar en paralelo
        await Promise.all(
            checks.map(async (check) => {
                try {
                    const { ok, detail } = await check.run();
                    setResults(prev => ({
                        ...prev,
                        [check.id]: { status: ok ? 'ok' : 'error', detail },
                    }));
                } catch (err) {
                    setResults(prev => ({
                        ...prev,
                        [check.id]: { status: 'error', detail: `Excepción: ${err.message}` },
                    }));
                }
            })
        );

        setLastRun(new Date());
        setRunning(false);
    }, [user]);

    // Conteos para el resumen
    // Early return DESPUÉS de todos los hooks — React exige orden constante de hooks.
    // Si se pone antes de useCallback/useMemo, cambia el número de hooks por render
    // cuando el rol cambia y lanza "Rendered fewer hooks than expected".
    if (userData?.role !== 'admin') return null;

    const total  = checks.length;
    const ok     = Object.values(results).filter(r => r.status === 'ok').length;
    const errors = Object.values(results).filter(r => r.status === 'error').length;
    const hasRun = lastRun !== null;

    return (
        <div className="bg-[#EDE8DC] p-4 rounded-2xl shadow-sm border border-[#D4C9B0]">

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-[#8B6914]" />
                    <h3 className="font-bold text-[#3D2B1F] text-xs uppercase tracking-wide">
                        Health Check del Sistema
                    </h3>
                    {hasRun && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            errors === 0
                                ? 'bg-green-100 text-green-700 border-green-200'
                                : 'bg-red-100 text-red-600 border-red-200'
                        }`}>
                            {errors === 0 ? `✅ ${ok}/${total} OK` : `⚠️ ${errors} error(es)`}
                        </span>
                    )}
                </div>

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

            {/* Descripción inicial */}
            {!hasRun && (
                <p className="text-xs text-[#A09070] mb-4 italic">
                    Corré este chequeo después de cada actualización para confirmar que todo funciona correctamente en producción.
                </p>
            )}

            {/* Lista de checks */}
            <div className="space-y-2">
                {checks.map(check => (
                    <CheckRow
                        key={check.id}
                        check={check}
                        result={results[check.id]}
                    />
                ))}
            </div>

            {/* Timestamp */}
            {lastRun && (
                <p className="text-[10px] text-[#A09070] mt-3 text-right italic">
                    Última verificación: {lastRun.toLocaleTimeString('es-AR')}
                </p>
            )}
        </div>
    );
}
