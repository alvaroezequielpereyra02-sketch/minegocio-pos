/**
 * _rateLimit.js — Rate limiting para endpoints de Vercel
 *
 * Estrategia: ventana deslizante con dos capas.
 *
 * Capa 1 — In-memory (Map):
 *   Bloquea ráfagas dentro de la misma instancia Lambda en <1ms.
 *   Se resetea en cold start, pero es la primera línea de defensa.
 *
 * Capa 2 — Firestore:
 *   Persiste los contadores entre instancias y cold starts.
 *   TTL automático: el documento se borra al expirar la ventana.
 *   Tolerante a errores: si Firestore falla, solo se usa la capa 1.
 *
 * Configuración por defecto:
 *   - 20 requests por IP por minuto  (ventana de 60 segundos)
 *   - 5  requests por IP por segundo (ventana de 1 segundo, anti-ráfaga)
 *
 * Uso:
 *   import { checkRateLimit } from './_rateLimit.js';
 *
 *   const result = await checkRateLimit(req, db);
 *   if (!result.ok) return res.status(429).json({ error: result.error });
 */

// ── Capa 1: In-memory (Map) ────────────────────────────────────────────────

// { ip → { count: number, windowStart: number } }
const memStore = new Map();

// Limpiar entradas expiradas cada 5 minutos para evitar memory leak
// en instancias de larga vida (Vercel las reutiliza hasta ~10 min)
const MEM_CLEANUP_INTERVAL = 5 * 60 * 1000;
setInterval(() => {
    const now = Date.now();
    for (const [key, val] of memStore.entries()) {
        if (now - val.windowStart > 60_000) memStore.delete(key);
    }
}, MEM_CLEANUP_INTERVAL);

/**
 * checkMemory(ip, limit, windowMs) → { ok, remaining, reset }
 */
function checkMemory(ip, limit, windowMs) {
    const now    = Date.now();
    const entry  = memStore.get(ip);
    const isNew  = !entry || (now - entry.windowStart) >= windowMs;
    const count  = isNew ? 1 : entry.count + 1;
    const start  = isNew ? now : entry.windowStart;

    memStore.set(ip, { count, windowStart: start });

    return {
        ok:        count <= limit,
        remaining: Math.max(0, limit - count),
        reset:     Math.ceil((start + windowMs - now) / 1000),
    };
}

// ── Capa 2: Firestore ─────────────────────────────────────────────────────

const FS_COLLECTION = 'rate_limits';

/**
 * checkFirestore(db, key, limit, windowMs) → { ok, remaining }
 *
 * Usa una transacción Firestore para leer y actualizar el contador de forma
 * atómica. El documento tiene TTL implícito: se resetea cuando expira la ventana.
 */
async function checkFirestore(db, key, limit, windowMs) {
    const ref = db.collection(FS_COLLECTION).doc(key);
    try {
        const result = await db.runTransaction(async (tx) => {
            const snap  = await tx.get(ref);
            const now   = Date.now();
            const data  = snap.exists ? snap.data() : null;
            const isNew = !data || (now - data.windowStart) >= windowMs;
            const count = isNew ? 1 : data.count + 1;
            const start = isNew ? now : data.windowStart;

            tx.set(ref, { count, windowStart: start, ip: key.split(':')[1] ?? key });

            return { ok: count <= limit, remaining: Math.max(0, limit - count) };
        });
        return result;
    } catch (err) {
        // Si Firestore falla (timeout, quota), no bloqueamos — la capa 1 ya protegió
        console.warn('[rateLimit] Firestore check failed, falling back to memory only:', err.message);
        return { ok: true, remaining: limit };
    }
}

// ── API pública ───────────────────────────────────────────────────────────

const LIMITS = {
    perMinute: { limit: 20, windowMs: 60_000 },  // 20 req/min
    perSecond: { limit: 5,  windowMs:  1_000 },  // 5 req/s (anti-ráfaga)
};

/**
 * getClientIp(req) → string
 *
 * Extrae la IP real teniendo en cuenta los proxies de Vercel.
 * x-forwarded-for puede contener múltiples IPs: "client, proxy1, proxy2".
 * Tomamos la primera (la del cliente real).
 */
function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        const first = forwarded.split(',')[0].trim();
        if (first) return first;
    }
    return req.socket?.remoteAddress ?? req.connection?.remoteAddress ?? 'unknown';
}

/**
 * checkRateLimit(req, db?) → Promise<{ ok, error?, headers }>
 *
 * @param req  — Request de Vercel (Node.js IncomingMessage)
 * @param db   — Instancia de Firestore Admin (opcional; si no se pasa, solo capa 1)
 *
 * Retorna:
 *   { ok: true,  headers }           → request permitido
 *   { ok: false, error, headers }    → bloqueado, devolver 429
 *
 * Los headers incluyen RateLimit-* para que el cliente pueda adaptarse.
 */
export async function checkRateLimit(req, db = null) {
    const ip = getClientIp(req);

    // ── Anti-ráfaga (solo memoria, suficiente para ventana de 1s) ─────────────
    const burstCheck = checkMemory(`burst:${ip}`, LIMITS.perSecond.limit, LIMITS.perSecond.windowMs);
    if (!burstCheck.ok) {
        return {
            ok:    false,
            error: 'Demasiadas solicitudes. Esperá un momento.',
            headers: {
                'Retry-After':               '1',
                'X-RateLimit-Limit':         String(LIMITS.perSecond.limit),
                'X-RateLimit-Remaining':     '0',
                'X-RateLimit-Reset':         String(burstCheck.reset),
                'X-RateLimit-Policy':        'burst',
            },
        };
    }

    // ── Ventana por minuto (memoria + Firestore) ───────────────────────────────
    const memCheck = checkMemory(`min:${ip}`, LIMITS.perMinute.limit, LIMITS.perMinute.windowMs);

    // Si ya la memoria dice que está dentro del límite y tenemos Firestore,
    // confirmar con Firestore para proteger contra múltiples instancias Lambda
    let fsCheck = { ok: true, remaining: memCheck.remaining };
    if (db && memCheck.remaining < LIMITS.perMinute.limit * 0.5) {
        // Solo consultamos Firestore cuando estamos en la segunda mitad del límite
        // para reducir lecturas de Firestore (costo y latencia)
        fsCheck = await checkFirestore(db, `notify:${ip}`, LIMITS.perMinute.limit, LIMITS.perMinute.windowMs);
    }

    const ok        = memCheck.ok && fsCheck.ok;
    const remaining = Math.min(memCheck.remaining, fsCheck.remaining);

    return {
        ok,
        error: ok ? undefined : `Límite de solicitudes alcanzado. Intentá en ${memCheck.reset} segundos.`,
        headers: {
            'X-RateLimit-Limit':     String(LIMITS.perMinute.limit),
            'X-RateLimit-Remaining': String(remaining),
            'X-RateLimit-Reset':     String(memCheck.reset),
            'X-RateLimit-Policy':    'minute',
            ...(ok ? {} : { 'Retry-After': String(memCheck.reset) }),
        },
    };
}
