// setAdmin.js
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
    credential: cert(serviceAccount)
});

// --- LISTA DE TUS 4 ADMINS ---
const ADMIN_EMAILS = [
    'alvaroezequielpereyra02@gmail.com',
    'fepereyra75@gmail.com',

];

async function grantAdminRoles() {
    console.log(`🚀 Iniciando proceso para ${ADMIN_EMAILS.length} usuarios...\n`);

    for (const email of ADMIN_EMAILS) {
        try {
            // 1. Buscar usuario
            const user = await getAuth().getUserByEmail(email);

            // 2. Asignar claim
            await getAuth().setCustomUserClaims(user.uid, { role: 'admin' });

            console.log(`✅ [OK] Admin asignado a: ${email} (UID: ${user.uid})`);
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                console.error(`⚠️ [ALERTA] El correo ${email} NO ESTÁ REGISTRADO en Firebase todavía.`);
            } else {
                console.error(`❌ [ERROR] Falló ${email}:`, error.message);
            }
        }
    }

    console.log('\n🏁 Proceso finalizado.');
    console.log('⚠️  Recuerda: Los usuarios deben cerrar sesión y volver a entrar para ver los cambios.');
}

grantAdminRoles();