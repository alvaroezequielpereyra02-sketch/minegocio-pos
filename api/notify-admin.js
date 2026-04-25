/**
 * api/notify-admin.js
 * Notifica a los administradores cuando llega un nuevo pedido.
 * Lee exclusivamente de `fcm_tokens` (colección de admins).
 * Los clientes nunca reciben estas notificaciones.
 */

import { checkRateLimit }   from './_rateLimit.js';
import {
    db, messaging,
    ADMIN_TOKENS_COLLECTION,
    ALLOWED_STORE_IDS,
    sanitize, applyHeaders,
    purgeInvalidTokens,
} from './_firebase.js';

// ── Validación ────────────────────────────────────────────────────────────────

function validateBody(body) {
    if (!body || typeof body !== 'object') return { ok: false, error: 'Body inválido' };

    const { storeId, transactionId, clientName, total, dry_run } = body;

    if (dry_run === true) return { ok: true, fields: { dry_run: true } };

    const cleanStoreId = sanitize(storeId, 100);
    if (!cleanStoreId) return { ok: false, error: 'storeId requerido' };
    if (!ALLOWED_STORE_IDS.has(cleanStoreId)) {
        console.warn(`[notify-admin] storeId rechazado: "${cleanStoreId}"`);
        return { ok: false, error: 'storeId no autorizado' };
    }

    const cleanTransactionId = sanitize(transactionId, 100);
    if (!cleanTransactionId || !/^[a-zA-Z0-9_\-]+$/.test(cleanTransactionId)) {
        return { ok: false, error: 'transactionId inválido' };
    }

    const cleanClientName = sanitize(clientName, 120);
    if (!cleanClientName) return { ok: false, error: 'clientName requerido' };

    const numTotal = Number(total);
    if (!Number.isFinite(numTotal) || numTotal < 0 || numTotal > 100_000_000) {
        return { ok: false, error: 'total inválido' };
    }

    return { ok: true, fields: { storeId: cleanStoreId, transactionId: cleanTransactionId, clientName: cleanClientName, total: numTotal } };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        applyHeaders(res, { Allow: 'POST' });
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const rate = await checkRateLimit(req, db);
    applyHeaders(res, rate.headers);
    if (!rate.ok) return res.status(429).json({ error: rate.error });

    const v = validateBody(req.body);
    if (!v.ok) return res.status(400).json({ error: v.error });
    if (v.fields.dry_run) return res.status(200).json({ success: true, message: 'dry_run OK' });

    const { storeId, transactionId, clientName, total } = v.fields;
    const title = '🛒 ¡Nuevo Pedido!';
    const body  = `${clientName} realizó un pedido por $${total.toLocaleString('es-AR')}`;

    try {
        const snapshot = await db
            .collection('stores').doc(storeId)
            .collection(ADMIN_TOKENS_COLLECTION)
            .get();

        if (snapshot.empty) {
            return res.status(200).json({ success: true, message: 'Sin tokens de admin' });
        }

        const mobileDocs  = [];
        const desktopDocs = [];
        snapshot.docs.forEach(d => {
            const { token, platform, uid } = d.data();
            if (!token) return;
            const entry = { token, uid: uid ?? d.id };
            if (platform === 'android' || platform === 'ios') mobileDocs.push(entry);
            else desktopDocs.push(entry);
        });

        let totalPurged = 0;

        if (mobileDocs.length > 0) {
            const result = await messaging.sendEachForMulticast({
                tokens:  mobileDocs.map(d => d.token),
                data:    { title, body, icon: '/logo192.png', badge: '/logo192.png', url: '/', transactionId },
                android: { priority: 'high' },
            });
            totalPurged += await purgeInvalidTokens(ADMIN_TOKENS_COLLECTION, storeId, result, mobileDocs);
        }

        if (desktopDocs.length > 0) {
            const result = await messaging.sendEachForMulticast({
                tokens:       desktopDocs.map(d => d.token),
                notification: { title, body },
                data:         { url: '/', transactionId },
                webpush: {
                    headers:      { Urgency: 'high', TTL: '60' },
                    notification: { title, body, icon: '/logo192.png', badge: '/logo192.png', vibrate: [200, 100, 200], tag: 'pedido-nuevo', renotify: true },
                    fcmOptions:   { link: '/' },
                },
            });
            totalPurged += await purgeInvalidTokens(ADMIN_TOKENS_COLLECTION, storeId, result, desktopDocs);
        }

        return res.status(200).json({
            success: true,
            sent:    { mobile: mobileDocs.length, desktop: desktopDocs.length },
            purged:  totalPurged,
        });

    } catch (err) {
        console.error('[notify-admin] Error:', err);
        return res.status(500).json({ error: 'Error interno' });
    }
}
