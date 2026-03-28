import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

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

// Errores FCM que indican token inválido → hay que borrarlo de Firestore
const INVALID_TOKEN_ERRORS = [
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
    'messaging/invalid-argument',
];

const isInvalidToken = (errorCode) =>
    INVALID_TOKEN_ERRORS.some(e => errorCode?.includes(e));

/**
 * Borra de Firestore los tokens que FCM rechazó como inválidos.
 * Se llama después de cada sendEachForMulticast.
 */
const purgeInvalidTokens = async (storeId, results, tokenDocs) => {
    const batch = db.batch();
    let purged = 0;

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
};

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { transactionId, clientName, total, storeId, dry_run } = req.body;

    // Modo health-check: verificar que el endpoint responde sin disparar FCM real
    if (dry_run === true) {
        return res.status(200).json({ success: true, message: 'dry_run OK — endpoint activo' });
    }

    const title = '🛒 ¡Nuevo Pedido!';
    const body  = `${clientName} realizó un pedido por $${Number(total).toLocaleString('es-AR')}`;

    try {
        const tokensSnapshot = await db
            .collection('stores').doc(storeId)
            .collection('fcm_tokens')
            .where('role', '==', 'admin')
            .get();

        if (tokensSnapshot.empty) {
            return res.status(200).json({ success: true, message: 'No tokens registrados' });
        }

        const mobileDocs  = [];
        const desktopDocs = [];

        tokensSnapshot.docs.forEach(doc => {
            const { token, platform, uid } = doc.data();
            if (!token) return;
            const entry = { token, uid: uid || doc.id };
            if (platform === 'android' || platform === 'ios') mobileDocs.push(entry);
            else desktopDocs.push(entry);
        });

        let totalPurged = 0;

        // ── MÓVIL ────────────────────────────────────────────────────────────
        if (mobileDocs.length > 0) {
            const result = await messaging.sendEachForMulticast({
                tokens: mobileDocs.map(d => d.token),
                data: {
                    title, body,
                    icon: '/logo192.png',
                    badge: '/logo192.png',
                    url: '/',
                    transactionId: transactionId || ''
                },
                android: { priority: 'high' }
            });
            totalPurged += await purgeInvalidTokens(storeId, result, mobileDocs);
        }

        // ── DESKTOP ──────────────────────────────────────────────────────────
        if (desktopDocs.length > 0) {
            const result = await messaging.sendEachForMulticast({
                tokens: desktopDocs.map(d => d.token),
                notification: { title, body },
                data: { url: '/', transactionId: transactionId || '' },
                webpush: {
                    headers: { Urgency: 'high', TTL: '60' },
                    notification: {
                        title, body,
                        icon: '/logo192.png',
                        badge: '/logo192.png',
                        vibrate: [200, 100, 200],
                        tag: 'pedido-nuevo',
                        renotify: true
                    },
                    fcmOptions: { link: '/' }
                }
            });
            totalPurged += await purgeInvalidTokens(storeId, result, desktopDocs);
        }

        return res.status(200).json({
            success: true,
            sent: { mobile: mobileDocs.length, desktop: desktopDocs.length },
            purged: totalPurged
        });

    } catch (error) {
        console.error('Error en /api/notify:', error);
        return res.status(500).json({ error: error.message });
    }
}
