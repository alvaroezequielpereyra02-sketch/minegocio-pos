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

        const mobileTokens = [];
        const desktopTokens = [];

        tokensSnapshot.docs.forEach(doc => {
            const { token, platform } = doc.data();
            if (!token) return;
            if (platform === 'android' || platform === 'ios') {
                mobileTokens.push(token);
            } else {
                desktopTokens.push(token);
            }
        });

        const sends = [];

        // MÓVIL: data-only + android.priority high
        // El SW muestra la notificación via onBackgroundMessage → sin duplicados
        if (mobileTokens.length > 0) {
            sends.push(
                messaging.sendEachForMulticast({
                    tokens: mobileTokens,
                    data: {
                        title,
                        body,
                        icon: '/logo192.png',
                        badge: '/logo192.png',
                        url: '/',
                        transactionId: transactionId || ''
                    },
                    android: {
                        priority: 'high'
                    }
                })
            );
        }

        // DESKTOP: notification top-level para que onBackgroundMessage lo reciba
        if (desktopTokens.length > 0) {
            sends.push(
                messaging.sendEachForMulticast({
                    tokens: desktopTokens,
                    notification: { title, body },
                    data: {
                        url: '/',
                        transactionId: transactionId || ''
                    },
                    webpush: {
                        headers: { Urgency: 'high', TTL: '60' },
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
                    }
                })
            );
        }

        await Promise.all(sends);

        return res.status(200).json({
            success: true,
            sent: { mobile: mobileTokens.length, desktop: desktopTokens.length }
        });

    } catch (error) {
        console.error('Error en /api/notify:', error);
        return res.status(500).json({ error: error.message });
    }
}
