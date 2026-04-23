/**
 * api/notify.js — Endpoint serverless de notificaciones push (FCM)
 *
 * Seguridad implementada:
 *   1. Rate limiting (20 req/min, 5 req/s) por IP — ver _rateLimit.js
 *   2. Validación y sanitización de todos los inputs del body
 *   3. storeId whitelist — solo acepta el storeId del proyecto
 *   4. Sanitización de strings para prevenir injection en mensajes FCM
 *   5. Headers de seguridad en todas las respuestas
 *   6. Mensajes de error que no exponen internals
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore }                  from 'firebase-admin/firestore';
import { getMessaging }                  from 'firebase-admin/messaging';
import { checkRateLimit }                from './_rateLimit.js';

// ── Firebase Admin init ───────────────────────────────────────────────────

const serviceAccount = {
    projectId:   process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!getApps().length) {
    initializeApp({ credential: cert(serviceAccount) });
}

const db        = getFirestore();
const messaging = getMessaging();

// ── Whitelist de storeIds permitidos ─────────────────────────────────────
// Evita que un atacante externo apunte el endpoint a otra tienda de Firebase.
// Si en el futuro la app es multi-tenant, mover esto a una colección Firestore.
const ALLOWED_STORE_IDS = new Set([
    process.env.FIREBASE_PROJECT_ID, // el proyecto activo
]);

// ── Errores FCM que indican token inválido → borrarlo de Firestore ────────
const INVALID_TOKEN_ERRORS = [
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
    'messaging/invalid-argument',
];
const isInvalidToken = (code) => INVALID_TOKEN_ERRORS.some(e => code?.includes(e));

// ── Sanitización de strings ───────────────────────────────────────────────

/**
 * sanitizeString(value, maxLen) → string
 *
 * - Convierte a string y recorta espacios
 * - Elimina caracteres de control (ASCII 0-31, excepto \t \n \r)
 * - Trunca al máximo permitido
 */
function sanitizeString(value, maxLen = 200) {
    if (value == null) return '';
    return String(value)
        .trim()
        // Eliminar caracteres de control: \x00-\x08, \x0B-\x0C, \x0E-\x1F
        // (mantiene \t=\x09, \n=\x0A, \r=\x0D que son inofensivos en este contexto)
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
        .slice(0, maxLen);
}

/**
 * validateBody(body) → { ok, error?, fields? }
 *
 * Valida y sanitiza el body del request.
 * Devuelve los campos limpios en { fields } si ok=true.
 */
function validateBody(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return { ok: false, error: 'Body inválido' };
    }

    const { transactionId, clientName, total, storeId, dry_run } = body;

    // dry_run — solo boolean
    if (dry_run !== undefined && typeof dry_run !== 'boolean') {
        return { ok: false, error: 'dry_run debe ser boolean' };
    }
    if (dry_run === true) {
        return { ok: true, fields: { dry_run: true } };
    }

    // storeId — requerido, whitelist
    const cleanStoreId = sanitizeString(storeId, 100);
    if (!cleanStoreId) {
        return { ok: false, error: 'storeId requerido' };
    }
    if (!ALLOWED_STORE_IDS.has(cleanStoreId)) {
        // No revelar la whitelist en el error — podría ayudar a un atacante a enumerar storeIds
        return { ok: false, error: 'storeId no autorizado' };
    }

    // transactionId — requerido, alfanumérico + guiones
    const cleanTransactionId = sanitizeString(transactionId, 100);
    if (!cleanTransactionId) {
        return { ok: false, error: 'transactionId requerido' };
    }
    if (!/^[a-zA-Z0-9_\-]+$/.test(cleanTransactionId)) {
        return { ok: false, error: 'transactionId contiene caracteres inválidos' };
    }

    // clientName — requerido, string libre pero sanitizado
    const cleanClientName = sanitizeString(clientName, 120);
    if (!cleanClientName) {
        return { ok: false, error: 'clientName requerido' };
    }

    // total — numérico, no negativo, razonable (< 100M)
    const numTotal = Number(total);
    if (!Number.isFinite(numTotal) || numTotal < 0 || numTotal > 100_000_000) {
        return { ok: false, error: 'total debe ser un número válido entre 0 y 100.000.000' };
    }

    return {
        ok: true,
        fields: {
            transactionId:  cleanTransactionId,
            clientName:     cleanClientName,
            total:          numTotal,
            storeId:        cleanStoreId,
        },
    };
}

// ── Headers de seguridad ──────────────────────────────────────────────────

const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options':        'DENY',
    'Referrer-Policy':        'no-referrer',
    // No ponemos HSTS aquí porque Vercel ya lo maneja a nivel de plataforma
};

function applyHeaders(res, extra = {}) {
    const all = { ...SECURITY_HEADERS, ...extra };
    Object.entries(all).forEach(([k, v]) => res.setHeader(k, v));
}

// ── Purga de tokens inválidos ─────────────────────────────────────────────

async function purgeInvalidTokens(storeId, results, tokenDocs) {
    const batch = db.batch();
    let purged  = 0;
    results.responses.forEach((resp, i) => {
        if (!resp.success && isInvalidToken(resp.error?.code)) {
            const docRef = db
                .collection('stores').doc(storeId)
                .collection('fcm_tokens').doc(tokenDocs[i].uid);
            batch.delete(docRef);
            purged++;
            console.log(`[notify] Token inválido eliminado: uid=${tokenDocs[i].uid}`);
        }
    });
    if (purged > 0) await batch.commit();
    return purged;
}

// ── Handler principal ─────────────────────────────────────────────────────

export default async function handler(req, res) {

    // ── 1. Método ─────────────────────────────────────────────────────────────
    if (req.method !== 'POST') {
        applyHeaders(res, { Allow: 'POST' });
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // ── 2. Rate limiting ──────────────────────────────────────────────────────
    const rateResult = await checkRateLimit(req, db);
    applyHeaders(res, rateResult.headers);
    if (!rateResult.ok) {
        return res.status(429).json({ error: rateResult.error });
    }

    // ── 3. Validación de body ─────────────────────────────────────────────────
    const validation = validateBody(req.body);
    if (!validation.ok) {
        return res.status(400).json({ error: validation.error });
    }

    // ── 4. dry_run ────────────────────────────────────────────────────────────
    if (validation.fields.dry_run) {
        return res.status(200).json({ success: true, message: 'dry_run OK — endpoint activo' });
    }

    const { transactionId, clientName, total, storeId } = validation.fields;

    const title = '🛒 ¡Nuevo Pedido!';
    const body  = `${clientName} realizó un pedido por $${total.toLocaleString('es-AR')}`;

    // ── 5. Envío FCM ──────────────────────────────────────────────────────────
    try {
        const tokensSnapshot = await db
            .collection('stores').doc(storeId)
            .collection('fcm_tokens')
            .where('role', '==', 'admin')
            .get();

        if (tokensSnapshot.empty) {
            return res.status(200).json({ success: true, message: 'No hay tokens registrados' });
        }

        const mobileDocs  = [];
        const desktopDocs = [];

        tokensSnapshot.docs.forEach(docSnap => {
            const { token, platform, uid } = docSnap.data();
            if (!token) return;
            const entry = { token, uid: uid ?? docSnap.id };
            if (platform === 'android' || platform === 'ios') mobileDocs.push(entry);
            else desktopDocs.push(entry);
        });

        let totalPurged = 0;

        if (mobileDocs.length > 0) {
            const result = await messaging.sendEachForMulticast({
                tokens: mobileDocs.map(d => d.token),
                data: {
                    title, body,
                    icon: '/logo192.png',
                    badge: '/logo192.png',
                    url: '/',
                    transactionId,
                },
                android: { priority: 'high' },
            });
            totalPurged += await purgeInvalidTokens(storeId, result, mobileDocs);
        }

        if (desktopDocs.length > 0) {
            const result = await messaging.sendEachForMulticast({
                tokens: desktopDocs.map(d => d.token),
                notification: { title, body },
                data: { url: '/', transactionId },
                webpush: {
                    headers:      { Urgency: 'high', TTL: '60' },
                    notification: {
                        title, body,
                        icon:     '/logo192.png',
                        badge:    '/logo192.png',
                        vibrate:  [200, 100, 200],
                        tag:      'pedido-nuevo',
                        renotify: true,
                    },
                    fcmOptions: { link: '/' },
                },
            });
            totalPurged += await purgeInvalidTokens(storeId, result, desktopDocs);
        }

        return res.status(200).json({
            success: true,
            sent:   { mobile: mobileDocs.length, desktop: desktopDocs.length },
            purged: totalPurged,
        });

    } catch (error) {
        // No exponer el stack trace ni el mensaje interno al cliente
        console.error('[notify] Error interno:', error);
        return res.status(500).json({ error: 'Error interno al enviar la notificación' });
    }
}
