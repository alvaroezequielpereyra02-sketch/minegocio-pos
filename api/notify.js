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

    const title = '🛒 ¡Nuevo Pedido!';
    const body = `${clientName} realizó un pedido por $${Number(total).toLocaleString('es-AR')}`;

    try {
        const tokensSnapshot = await db
            .collection('stores').doc(storeId)
            .collection('fcm_tokens')
            .where('role', '==', 'admin')
            .get();

        if (tokensSnapshot.empty) {
            return res.status(200).json({ success: true, message: 'No tokens registrados' });
        }

        const tokens = tokensSnapshot.docs.map(doc => doc.data().token).filter(Boolean);

        const response = await messaging.sendEachForMulticast({
            tokens,

            // top-level notification: necesario para que Android despierte Chrome cerrado
            // El sistema (Google Play Services) lo entrega sin necesidad de que Chrome esté vivo
            notification: { title, body },

            // data: disponible en el SW para manejar el click
            data: {
                url: '/',
                transactionId: transactionId || ''
            },

            // webpush: configuración para Chrome en PC y Android
            // Al poner notification acá también, Chrome la muestra con ícono correcto
            webpush: {
                headers: {
                    Urgency: 'high',
                    TTL: '60'
                },
                notification: {
                    title,
                    body,
                    icon: '/logo192.png',
                    badge: '/logo192.png',
                    vibrate: [200, 100, 200],
                    tag: 'pedido-nuevo',
                    renotify: true
                },
                fcmOptions: { link: '/' }
            },

            android: {
                priority: 'high',
                notification: {
                    color: '#2563eb',
                    sound: 'default'
                }
            }
        });

        // Limpieza de tokens inválidos
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
