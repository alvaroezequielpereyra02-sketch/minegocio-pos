/**
 * api/_firebase.js — Inicialización compartida de Firebase Admin + utilidades FCM
 *
 * Todos los endpoints de notificación importan desde acá para evitar
 * inicializar Firebase Admin múltiples veces y mantener la lógica de
 * purga de tokens en un solo lugar.
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore }                  from 'firebase-admin/firestore';
import { getMessaging }                  from 'firebase-admin/messaging';

if (!getApps().length) {
    initializeApp({
        credential: cert({
            projectId:   process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}

export const db        = getFirestore();
export const messaging = getMessaging();

// ─── Colecciones de tokens ────────────────────────────────────────────────────
// Separadas por rol para aislar completamente los flujos de notificación.
// Los admins nunca reciben ofertas de usuarios; los clientes nunca reciben
// notificaciones de pedidos del backoffice.
export const ADMIN_TOKENS_COLLECTION = 'fcm_tokens';       // roles: admin
export const USER_TOKENS_COLLECTION  = 'fcm_tokens_users'; // roles: client

// ─── Whitelist de storeIds ────────────────────────────────────────────────────
export const ALLOWED_STORE_IDS = new Set(
    [process.env.FIREBASE_PROJECT_ID, process.env.VITE_STORE_ID].filter(Boolean)
);

// ─── Helpers de seguridad ─────────────────────────────────────────────────────

export const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options':        'DENY',
    'Referrer-Policy':        'no-referrer',
};

export function sanitize(value, maxLen = 200) {
    if (value == null) return '';
    return String(value).trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').slice(0, maxLen);
}

export function applyHeaders(res, extra = {}) {
    Object.entries({ ...SECURITY_HEADERS, ...extra }).forEach(([k, v]) => res.setHeader(k, v));
}

// ─── Purga de tokens inválidos ────────────────────────────────────────────────

const INVALID_TOKEN_CODES = [
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
    'messaging/invalid-argument',
];

/**
 * purgeInvalidTokens(collection, storeId, results, tokenDocs)
 * Borra de Firestore los tokens que FCM rechazó como inválidos.
 * Se llama después de cada sendEachForMulticast.
 */
export async function purgeInvalidTokens(collection, storeId, results, tokenDocs) {
    const batch = db.batch();
    let purged  = 0;

    results.responses.forEach((resp, i) => {
        const code = resp.error?.code ?? '';
        if (!resp.success && INVALID_TOKEN_CODES.some(e => code.includes(e))) {
            batch.delete(
                db.collection('stores').doc(storeId).collection(collection).doc(tokenDocs[i].uid)
            );
            purged++;
            console.log(`[FCM] Token inválido eliminado de ${collection}: uid=${tokenDocs[i].uid}`);
        }
    });

    if (purged > 0) await batch.commit();
    return purged;
}

/**
 * sendInChunks(tokenDocs, messageBuilder, collection, storeId)
 * FCM acepta máximo 500 tokens por llamada — divide automáticamente si hay más.
 */
export async function sendInChunks(tokenDocs, messageBuilder, collection, storeId) {
    const CHUNK = 500;
    let sent = 0, purged = 0;
    for (let i = 0; i < tokenDocs.length; i += CHUNK) {
        const chunk  = tokenDocs.slice(i, i + CHUNK);
        const result = await messaging.sendEachForMulticast(messageBuilder(chunk));
        sent   += chunk.length;
        purged += await purgeInvalidTokens(collection, storeId, result, chunk);
    }
    return { sent, purged };
}

/**
 * getTokensByPlatform(snapshot)
 * Separa los tokens en móviles y desktop para usar las configuraciones
 * correctas de FCM (data-only para Android, webpush para desktop).
 */
export function getTokensByPlatform(snapshot) {
    const mobileDocs  = [];
    const desktopDocs = [];
    snapshot.docs.forEach(d => {
        const { token, platform, uid } = d.data();
        if (!token) return;
        const entry = { token, uid: uid ?? d.id };
        if (platform === 'android' || platform === 'ios') mobileDocs.push(entry);
        else desktopDocs.push(entry);
    });
    return { mobileDocs, desktopDocs };
}
