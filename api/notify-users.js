/**
 * api/notify-users.js
 * Envía notificaciones de ofertas a todos los clientes registrados.
 * Lee exclusivamente de `fcm_tokens_users` (colección de clientes).
 * Los admins nunca reciben estas notificaciones.
 */

import { checkRateLimit } from './_rateLimit.js';
import {
    db,
    USER_TOKENS_COLLECTION,
    ALLOWED_STORE_IDS,
    sanitize, applyHeaders,
    sendInChunks,
} from './_firebase.js';

// ── Validación ────────────────────────────────────────────────────────────────

function validateBody(body) {
    if (!body || typeof body !== 'object') return { ok: false, error: 'Body inválido' };

    const { storeId, offerId, title, description, dry_run } = body;

    if (dry_run === true) return { ok: true, fields: { dry_run: true } };

    const cleanStoreId = sanitize(storeId, 100);
    if (!cleanStoreId) return { ok: false, error: 'storeId requerido' };
    if (!ALLOWED_STORE_IDS.has(cleanStoreId)) {
        console.warn(`[notify-users] storeId rechazado: "${cleanStoreId}"`);
        return { ok: false, error: 'storeId no autorizado' };
    }

    const cleanOfferId = sanitize(offerId, 100);
    if (!cleanOfferId || !/^[a-zA-Z0-9_\-]+$/.test(cleanOfferId)) {
        return { ok: false, error: 'offerId inválido' };
    }

    const cleanTitle = sanitize(title, 80);
    if (!cleanTitle) return { ok: false, error: 'title requerido' };

    return {
        ok: true,
        fields: {
            storeId:     cleanStoreId,
            offerId:     cleanOfferId,
            title:       cleanTitle,
            description: sanitize(description, 200),
        },
    };
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

    const { storeId, offerId, title, description } = v.fields;
    const notifTitle = `🏷️ ${title}`;
    const notifBody  = description || '¡Nueva oferta disponible en la tienda!';

    try {
        const snapshot = await db
            .collection('stores').doc(storeId)
            .collection(USER_TOKENS_COLLECTION)
            .get();

        if (snapshot.empty) {
            return res.status(200).json({ success: true, message: 'Sin tokens de usuarios' });
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

        let totalSent = 0, totalPurged = 0;

        if (mobileDocs.length > 0) {
            const { sent, purged } = await sendInChunks(
                mobileDocs,
                (chunk) => ({
                    tokens:  chunk.map(d => d.token),
                    data:    { title: notifTitle, body: notifBody, url: '/', offerId },
                    android: { priority: 'high' },
                }),
                USER_TOKENS_COLLECTION,
                storeId
            );
            totalSent += sent; totalPurged += purged;
        }

        if (desktopDocs.length > 0) {
            const { sent, purged } = await sendInChunks(
                desktopDocs,
                (chunk) => ({
                    tokens:       chunk.map(d => d.token),
                    notification: { title: notifTitle, body: notifBody },
                    data:         { url: '/', offerId },
                    webpush: {
                        headers:      { Urgency: 'high', TTL: '86400' },
                        notification: { title: notifTitle, body: notifBody, icon: '/logo192.png', badge: '/logo192.png', tag: `offer-${offerId}`, renotify: false },
                        fcmOptions:   { link: '/' },
                    },
                }),
                USER_TOKENS_COLLECTION,
                storeId
            );
            totalSent += sent; totalPurged += purged;
        }

        return res.status(200).json({
            success: true,
            sent:    { mobile: mobileDocs.length, desktop: desktopDocs.length, total: totalSent },
            purged:  totalPurged,
        });

    } catch (err) {
        console.error('[notify-users] Error:', err);
        return res.status(500).json({ error: 'Error interno' });
    }
}
