import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

// Estas variables las configurarás en el panel de Vercel
const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!getApps().length) {
    initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();
const messaging = getMessaging();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { transactionId, clientName, total, storeId } = req.body;

    try {
        // 1. Obtener tokens de admins filtrando por el storeId actual
        const tokensSnapshot = await db
            .collection('stores').doc(storeId)
            .collection('fcm_tokens')
            .where('role', '==', 'admin')
            .get();

        if (tokensSnapshot.empty) return res.status(200).json({ success: true, message: 'No tokens' });

        const tokens = tokensSnapshot.docs.map(doc => doc.data().token).filter(Boolean);

        // 2. Enviar notificación (Misma estructura que tu index.js original)
        const response = await messaging.sendEachForMulticast({
            tokens,
            notification: {
                title: '🛒 ¡Nuevo Pedido!',
                body: `${clientName} realizó un pedido por $${total.toLocaleString('es-AR')}`,
            },
            data: { url: '/', transactionId },
            webpush: {
                notification: { icon: '/logo192.png', badge: '/logo192.png' },
                fcmOptions: { link: '/' }
            }
        });

        // 3. Limpieza de tokens inválidos
        const invalidTokens = [];
        response.responses.forEach((resp, idx) => {
            if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
                invalidTokens.push(tokens[idx]);
            }
        });

        if (invalidTokens.length > 0) {
            const batch = db.batch();
            const tokenDocs = await db.collection('stores').doc(storeId)
                .collection('fcm_tokens').where('token', 'in', invalidTokens).get();
            tokenDocs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}