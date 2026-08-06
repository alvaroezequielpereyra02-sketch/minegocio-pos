/**
 * GET  /api/auth/invites  → lista los códigos de invitación de la tienda (solo admin)
 * POST /api/auth/invites  → genera un código nuevo (solo admin)
 *
 * Body de POST: { role: 'employee' | 'admin', expiresInDays?: number }
 * Si expiresInDays no se manda, el código no expira.
 */
import { supabase }          from '../../_supabase.js';
import { requireAdmin }      from '../../_middleware.js';
import { mapInvitationCode } from '../../_mappers.js';

const STORE_ID = process.env.SUPABASE_STORE_ID;

// Excluye caracteres ambiguos (0/O, 1/I/L) para que sea fácil de tipear a mano
// cuando se lo pasás a un empleado por WhatsApp o de palabra.
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateCode(length = 8) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

async function handler(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('invitation_codes')
      .select('*')
      .eq('store_id', STORE_ID)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: 'Error al listar códigos.' });
    return res.status(200).json(data.map(mapInvitationCode));
  }

  if (req.method === 'POST') {
    const { role = 'employee', expiresInDays } = req.body || {};

    if (!['admin', 'employee'].includes(role)) {
      return res.status(400).json({ error: "role debe ser 'admin' o 'employee'." });
    }

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // Reintenta si por casualidad el código generado ya existe.
    // Con 32^8 combinaciones posibles es extremadamente improbable, pero
    // el reintento es barato y evita un error confuso en ese caso límite.
    let data, insertError;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      const result = await supabase
        .from('invitation_codes')
        .insert({
          store_id:   STORE_ID,
          code,
          role,
          expires_at: expiresAt,
          created_by: req.user.sub,
        })
        .select()
        .single();

      if (!result.error) { data = result.data; insertError = null; break; }
      insertError = result.error;
      if (result.error.code !== '23505') break; // no es error de duplicado → no reintentar
    }

    if (insertError) return res.status(500).json({ error: 'Error al generar el código.' });
    return res.status(201).json(mapInvitationCode(data));
  }

  return res.status(405).json({ error: 'Método no permitido.' });
}

export default requireAdmin(handler);
