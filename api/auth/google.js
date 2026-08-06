/**
 * POST /api/auth/google
 *
 * Login / registro automático de CLIENTES con Google.
 * Este endpoint SIEMPRE crea usuarios nuevos con role='client' — nunca
 * admin ni employee. Esos roles solo se otorgan mediante código de
 * invitación en /api/auth/invite.js, que corre en el servidor y no puede
 * ser manipulado desde el navegador.
 *
 * Flujo:
 * 1. Verificar el id_token de Google.
 * 2. Si ya existe un usuario con ese google_id en esta tienda → login.
 * 3. Si no existe pero hay un usuario con el mismo email (sin google_id
 *    vinculado, por ejemplo cargado a mano) → vincular esa cuenta.
 * 4. Si no existe de ninguna forma → crear cliente nuevo con
 *    profile_complete=false (fuerza el formulario obligatorio antes de
 *    poder comprar: nombre del negocio, dirección, teléfono).
 */
import { supabase }          from '../_supabase.js';
import { verifyGoogleToken } from '../_google.js';
import { signToken }         from '../_middleware.js';
import { mapUser }           from '../_mappers.js';

const STORE_ID = process.env.SUPABASE_STORE_ID;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  try {
    const { idToken } = req.body || {};
    const google = await verifyGoogleToken(idToken);

    // 1. ¿Ya existe por google_id?
    const { data: existing, error: findErr } = await supabase
      .from('users')
      .select('*')
      .eq('store_id', STORE_ID)
      .eq('google_id', google.googleId)
      .maybeSingle();

    if (findErr) throw findErr;

    let userRow = existing;

    if (!userRow) {
      // 2. ¿Existe por email pero sin google_id vinculado?
      const { data: byEmail, error: emailErr } = await supabase
        .from('users')
        .select('*')
        .eq('store_id', STORE_ID)
        .eq('email', google.email)
        .maybeSingle();

      if (emailErr) throw emailErr;

      if (byEmail) {
        const { data: linked, error: linkErr } = await supabase
          .from('users')
          .update({ google_id: google.googleId, avatar_url: google.avatarUrl })
          .eq('id', byEmail.id)
          .select()
          .single();
        if (linkErr) throw linkErr;
        userRow = linked;
      } else {
        // 3. Usuario totalmente nuevo → cliente.
        const { data: created, error: createErr } = await supabase
          .from('users')
          .insert({
            store_id:         STORE_ID,
            email:            google.email,
            name:             google.name,
            google_id:        google.googleId,
            avatar_url:       google.avatarUrl,
            role:             'client',
            profile_complete: false,
          })
          .select()
          .single();
        if (createErr) throw createErr;
        userRow = created;
      }
    }

    if (userRow.is_active === false) {
      return res.status(403).json({ error: 'Esta cuenta fue desactivada. Contactate con el negocio.' });
    }

    const token = signToken({
      id:       userRow.id,
      role:     userRow.role,
      store_id: STORE_ID,
      email:    userRow.email,
      name:     userRow.name,
    });

    return res.status(200).json({ user: mapUser(userRow), token });

  } catch (e) {
    console.error('[auth/google] Error:', e.message);
    return res.status(e.status || 500).json({
      error: e.status ? e.message : 'Error interno del servidor.',
    });
  }
}
