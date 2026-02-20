import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

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
        // 1. Obtener tokens de admins
        const tokensSnapshot = await db
            .collection('stores').doc(storeId)
            .collection('fcm_tokens')
            .where('role', '==', 'admin')
            .get();

        if (tokensSnapshot.empty) {
            return res.status(200).json({ success: true, message: 'No tokens registrados' });
        }

        const tokens = tokensSnapshot.docs.map(doc => doc.data().token).filter(Boolean);

        // 2. Payload DATA-ONLY: fuerza que el SW maneje la notificación
        //    Esto evita que Android muestre la notificación por su cuenta (y la pierda)
        const response = await messaging.sendEachForMulticast({
            tokens,
            data: {
                title: '🛒 ¡Nuevo Pedido!',
                body: `${clientName} realizó un pedido por $${Number(total).toLocaleString('es-AR')}`,
                icon: '/logo192.png',
                badge: '/logo192.png',
                url: '/',
                transactionId: transactionId || ''
            },
            // webpush.headers es clave para que llegue aunque la app esté cerrada
            webpush: {
                headers: {
                    Urgency: 'high',
                    TTL: '60'
                },
                fcmOptions: {
                    link: '/'
                }
            },
            android: {
                priority: 'high'
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
            const tokenDocs = await db
                .collection('stores').doc(storeId)
                .collection('fcm_tokens')
                .where('token', 'in', invalidTokens)
                .get();
            tokenDocs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }

        return res.status(200).json({ success: true, sent: tokens.length });

    } catch (error) {
        console.error('Error en /api/notify:', error);
        return res.status(500).json({ error: error.message });
    }
}
