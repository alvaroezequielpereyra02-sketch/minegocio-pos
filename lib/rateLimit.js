/**
 * lib/rateLimit.js — Rate limiting para endpoints de Vercel
 *
 * Movido desde api/_rateLimit.js (Fase 2A — consolidación de funciones).
 * Sin cambios de lógica, solo de ubicación.
 *
 * Estrategia: ventana deslizante con dos capas.
 * Capa 1 — In-memory (Map): bloquea ráfagas dentro de la misma instancia Lambda.
 * Capa 2 — Firestore: persiste los contadores entre instancias y cold starts.
 */

const memStore = new Map();

const MEM_CLEANUP_INTERVAL = 5 * 60 * 1000;
setInterval(() => {
    const now = Date.now();
    for (const [key, val] of memStore.entries()) {
        if (now - val.windowStart > 60_000) memStore.delete(key);
    }
}, MEM_CLEANUP_INTERVAL);

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

const FS_COLLECTION = 'rate_limits';

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
        console.warn('[rateLimit] Firestore check failed, falling back to memory only:', err.message);
        return { ok: true, remaining: limit };
    }
}

const LIMITS = {
    perMinute: { limit: 20, windowMs: 60_000 },
    perSecond: { limit: 5,  windowMs:  1_000 },
};

function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        const first = forwarded.split(',')[0].trim();
        if (first) return first;
    }
    return req.socket?.remoteAddress ?? req.connection?.remoteAddress ?? 'unknown';
}

export async function checkRateLimit(req, db = null) {
    const ip = getClientIp(req);

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

    const memCheck = checkMemory(`min:${ip}`, LIMITS.perMinute.limit, LIMITS.perMinute.windowMs);

    let fsCheck = { ok: true, remaining: memCheck.remaining };
    if (db && memCheck.remaining < LIMITS.perMinute.limit * 0.5) {
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
