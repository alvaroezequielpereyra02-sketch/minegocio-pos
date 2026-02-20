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

        // 2. PAYLOAD HÍBRIDO
        //
        //    - `notification` (top level): lo usa el cliente FCM de Android a nivel de sistema.
        //      Esto permite mostrar la notificación aunque Chrome esté completamente cerrado,
        //      porque el servicio de Google Play (no Chrome) la entrega.
        //
        //    - `data`: siempre llega al SW para que pueda manejar el click y enrutar a la URL.
        //
        //    - `webpush`: configuración específica para Chrome en PC/Mac.
        //
        const response = await messaging.sendEachForMulticast({
            tokens,

            // Datos disponibles en el SW siempre (Android y Web)
            data: {
                title,
                body,
                icon: '/logo192.png',
                badge: '/logo192.png',
                url: '/',
                transactionId: transactionId || ''
            },

            // Notificación a nivel sistema: usada por Android cuando Chrome está cerrado
            notification: {
                title,
                body
            },

            // Android: alta prioridad para despertar el dispositivo
            android: {
                priority: 'high',
                notification: {
                    color: '#2563eb',
                    sound: 'default',
                    channelId: 'pedidos'
                }
            },

            // Web: SW maneja la notificación vía onBackgroundMessage
            webpush: {
                headers: {
                    Urgency: 'high',
                    TTL: '60'
                },
                fcmOptions: {
                    link: '/'
                }
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
