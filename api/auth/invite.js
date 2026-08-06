/**
 * POST /api/auth/invite
 *
 * Registro (o ascenso) de EMPLEADOS y ADMIN mediante código de invitación.
 * El rol viene siempre del código (invitation_codes.role) — nunca lo elige
 * el cliente. Esto es lo que hace que el sistema sea seguro: la asignación
 * de rol pasa siempre por acá, en el backend, con la service key. Nunca por
 * un valor que mande el navegador.
 *
 * Si la persona ya tenía cuenta como cliente, esta llamada la asciende
 * (actualiza su rol) en lugar de crear una cuenta duplicada.
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
    const { idToken, inviteCode } = req.body || {};

    if (!inviteCode || typeof inviteCode !== 'string') {
      return res.status(400).json({ error: 'Código de invitación requerido.' });
    }

    const google = await verifyGoogleToken(idToken);
    const cleanCode = inviteCode.trim().toUpperCase();

    // 1. Validar el código: existe, no fue usado, no expiró.
    const { data: invite, error: inviteErr } = await supabase
      .from('invitation_codes')
      .select('*')
      .eq('store_id', STORE_ID)
      .eq('code', cleanCode)
      .is('used_by', null)
      .maybeSingle();

    if (inviteErr) throw inviteErr;
    if (!invite) {
      return res.status(400).json({ error: 'Código de invitación inválido o ya utilizado.' });
    }
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Este código de invitación expiró.' });
    }

    // 2. ¿El usuario ya existe? (puede ser un cliente que asciende a empleado)
    const { data: existing, error: findErr } = await supabase
      .from('users')
      .select('*')
      .eq('store_id', STORE_ID)
      .eq('google_id', google.googleId)
      .maybeSingle();

    if (findErr) throw findErr;

    let userRow;

    if (existing) {
      const { data: updated, error: updateErr } = await supabase
        .from('users')
        .update({
          role:              invite.role,
          profile_complete:  true, // el staff no pasa por el formulario obligatorio de cliente
          avatar_url:        google.avatarUrl,
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (updateErr) throw updateErr;
      userRow = updated;
    } else {
      const { data: created, error: createErr } = await supabase
        .from('users')
        .insert({
          store_id:         STORE_ID,
          email:            google.email,
          name:             google.name,
          google_id:        google.googleId,
          avatar_url:       google.avatarUrl,
          role:             invite.role,
          profile_complete: true,
        })
        .select()
        .single();
      if (createErr) throw createErr;
      userRow = created;
    }

    // 3. Marcar el código como usado — no se puede reutilizar.
    const { error: markErr } = await supabase
      .from('invitation_codes')
      .update({ used_by: userRow.id, used_at: new Date().toISOString() })
      .eq('id', invite.id);
    if (markErr) throw markErr;

    const token = signToken({
      id:       userRow.id,
      role:     userRow.role,
      store_id: STORE_ID,
      email:    userRow.email,
      name:     userRow.name,
    });

    return res.status(200).json({ user: mapUser(userRow), token });

 } catch (e) {
    console.error('[auth/invite] Error:', e.message);
    return res.status(e.status || 500).json({
      error: e.status ? e.message : 'Error interno del servidor.',
    });
  }
}
  