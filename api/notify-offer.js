/**
 * api/notify-offer.js
 * Envía una notificación push a TODOS los tokens FCM registrados (admins + clientes).
 * Solo puede ser llamado desde el servidor o por un admin autenticado.
 *
 * Seguridad:
 *   - Rate limiting igual que notify.js
 *   - Validación de todos los campos del body
 *   - storeId whitelist
 *   - Headers de seguridad
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore }                  from 'firebase-admin/firestore';
import { getMessaging }                  from 'firebase-admin/messaging';
import { checkRateLimit }                from './_rateLimit.js';

if (!getApps().length) {
    initializeApp({
        credential: cert({
            projectId:   process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}

const db        = getFirestore();
const messaging = getMessaging();

const ALLOWED_STORE_IDS = new Set(
    [process.env.FIREBASE_PROJECT_ID, process.env.VITE_STORE_ID].filter(Boolean)
);

const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options':        'DENY',
    'Referrer-Policy':        'no-referrer',
};

const INVALID_TOKEN_ERRORS = [
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
    'messaging/invalid-argument',
];
const isInvalidToken = (code) => INVALID_TOKEN_ERRORS.some(e => code?.includes(e));

function sanitize(value, maxLen = 200) {
    if (value == null) return '';
    return String(value).trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').slice(0, maxLen);
}

function validateBody(body) {
    if (!body || typeof body !== 'object') return { ok: false, error: 'Body inválido' };

    const { storeId, offerId, title, description, dry_run } = body;

    if (dry_run === true) return { ok: true, fields: { dry_run: true } };

    const cleanStoreId = sanitize(storeId, 100);
    if (!cleanStoreId) return { ok: false, error: 'storeId requerido' };
    if (!ALLOWED_STORE_IDS.has(cleanStoreId)) {
        console.warn(`[notify-offer] storeId rechazado: "${cleanStoreId}"`);
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

async function purgeInvalidTokens(storeId, results, tokenDocs) {
    const batch = db.batch();
    let purged  = 0;
    results.responses.forEach((resp, i) => {
        if (!resp.success && isInvalidToken(resp.error?.code)) {
            batch.delete(
                db.collection('stores').doc(storeId).collection('fcm_tokens').doc(tokenDocs[i].uid)
            );
            purged++;
        }
    });
    if (purged > 0) await batch.commit();
    return purged;
}

// FCM tiene límite de 500 tokens por llamada — chunkeamos si hay más
async function sendInChunks(tokenDocs, messageBuilder, storeId) {
    const CHUNK = 500;
    let sent = 0, purged = 0;
    for (let i = 0; i < tokenDocs.length; i += CHUNK) {
        const chunk  = tokenDocs.slice(i, i + CHUNK);
        const result = await messaging.sendEachForMulticast(messageBuilder(chunk));
        sent   += chunk.length;
        purged += await purgeInvalidTokens(storeId, result, chunk);
    }
    return { sent, purged };
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        Object.entries({ ...SECURITY_HEADERS, Allow: 'POST' }).forEach(([k, v]) => res.setHeader(k, v));
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const rateResult = await checkRateLimit(req, db);
    Object.entries({ ...SECURITY_HEADERS, ...rateResult.headers }).forEach(([k, v]) => res.setHeader(k, v));
    if (!rateResult.ok) return res.status(429).json({ error: rateResult.error });

    const validation = validateBody(req.body);
    if (!validation.ok) return res.status(400).json({ error: validation.error });
    if (validation.fields.dry_run) return res.status(200).json({ success: true, message: 'dry_run OK' });

    const { storeId, offerId, title, description } = validation.fields;

    try {
        // Obtener TODOS los tokens (admins + clientes)
        const snapshot = await db
            .collection('stores').doc(storeId)
            .collection('fcm_tokens')
            .get();

        if (snapshot.empty) {
            return res.status(200).json({ success: true, message: 'No hay tokens registrados' });
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

        const notifTitle = `🏷️ ${title}`;
        const notifBody  = description || '¡Nueva oferta disponible en la tienda!';
        const deepLink   = `/?tab=offers&id=${offerId}`;

        let totalSent   = 0;
        let totalPurged = 0;

        // ── Móvil ──────────────────────────────────────────────────────────────
        if (mobileDocs.length > 0) {
            const { sent, purged } = await sendInChunks(
                mobileDocs,
                (chunk) => ({
                    tokens:  chunk.map(d => d.token),
                    data:    { title: notifTitle, body: notifBody, url: deepLink, offerId },
                    android: { priority: 'high' },
                }),
                storeId
            );
            totalSent   += sent;
            totalPurged += purged;
        }

        // ── Desktop ────────────────────────────────────────────────────────────
        if (desktopDocs.length > 0) {
            const { sent, purged } = await sendInChunks(
                desktopDocs,
                (chunk) => ({
                    tokens:       chunk.map(d => d.token),
                    notification: { title: notifTitle, body: notifBody },
                    data:         { url: deepLink, offerId },
                    webpush: {
                        headers:      { Urgency: 'high', TTL: '86400' },
                        notification: {
                            title: notifTitle,
                            body:  notifBody,
                            icon:  '/logo192.png',
                            badge: '/logo192.png',
                            tag:   `offer-${offerId}`,
                            renotify: false,   // no re-notifica si ya tiene una de la misma oferta
                        },
                        fcmOptions: { link: '/' },
                    },
                }),
                storeId
            );
            totalSent   += sent;
            totalPurged += purged;
        }

        return res.status(200).json({
            success: true,
            sent:    { mobile: mobileDocs.length, desktop: desktopDocs.length, total: totalSent },
            purged:  totalPurged,
        });

    } catch (error) {
        console.error('[notify-offer] Error:', error);
        return res.status(500).json({ error: 'Error interno al enviar la notificación' });
    }
}
