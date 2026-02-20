/**
 * Firebase Cloud Function: notifyNewOrder
 * 
 * Se dispara automáticamente cuando se crea un nuevo documento
 * en la colección de transacciones.
 * 
 * Lee los FCM tokens de todos los admins guardados en Firestore
 * y envía una notificación push a cada uno.
 * 
 * DEPLOY:
 *   npm install -g firebase-tools
 *   cd functions && npm install
 *   firebase deploy --only functions
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp }     = require('firebase-admin/app');
const { getFirestore }      = require('firebase-admin/firestore');
const { getMessaging }      = require('firebase-admin/messaging');

initializeApp();

const STORE_ID = process.env.STORE_ID || 'tienda-principal';

exports.notifyNewOrder = onDocumentCreated(
    `stores/${STORE_ID}/transactions/{transactionId}`,
    async (event) => {
        const transaction = event.data?.data();
        if (!transaction) return;

        // Solo notificar si es un pedido de cliente (no una venta del admin)
        if (transaction.clientRole !== 'client') return;

        const db        = getFirestore();
        const messaging = getMessaging();

        try {
            // Obtener todos los FCM tokens de usuarios con rol admin
            const tokensSnapshot = await db
                .collection('stores').doc(STORE_ID)
                .collection('fcm_tokens')
                .where('role', '==', 'admin')
                .get();

            if (tokensSnapshot.empty) {
                console.log('No hay tokens de admin registrados.');
                return;
            }

            const tokens = tokensSnapshot.docs
                .map(doc => doc.data().token)
                .filter(Boolean);

            if (tokens.length === 0) return;

            const clientName = transaction.clientName || 'Un cliente';
            const total      = transaction.total?.toLocaleString('es-AR') || '0';

            // Enviar notificación a todos los admins
            const response = await messaging.sendEachForMulticast({
                tokens,
                notification: {
                    title: '🛒 ¡Nuevo Pedido!',
                    body:  `${clientName} realizó un pedido por $${total}`,
                },
                data: {
                    url:           '/',
                    transactionId: event.params.transactionId,
                },
                webpush: {
                    notification: {
                        icon:  '/logo192.png',
                        badge: '/logo192.png',
                        vibrate: '[200, 100, 200]',
                        tag: 'pedido-nuevo',
                        renotify: 'true',
                    },
                    fcmOptions: { link: '/' }
                },
                android: {
                    notification: {
                        icon:      'logo192',
                        color:     '#2563eb',
                        channelId: 'pedidos',
                        priority:  'high',
                    }
                }
            });

            // Limpiar tokens que ya no son válidos (dispositivos desregistrados)
            const invalidTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
                    invalidTokens.push(tokens[idx]);
                }
            });

            if (invalidTokens.length > 0) {
                const batch = db.batch();
                const tokenDocs = await db
                    .collection('stores').doc(STORE_ID)
                    .collection('fcm_tokens')
                    .where('token', 'in', invalidTokens)
                    .get();
                tokenDocs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                console.log(`Limpiados ${invalidTokens.length} tokens inválidos.`);
            }

            console.log(`Notificaciones enviadas: ${response.successCount} OK, ${response.failureCount} fallaron.`);
        } catch (error) {
            console.error('Error enviando notificaciones:', error);
        }
    }
);
