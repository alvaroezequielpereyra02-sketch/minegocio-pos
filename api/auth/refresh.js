/**
 * POST /api/auth/refresh
 *
 * "Desliza" la sesión hacia adelante: si el token actual todavía es válido,
 * emite uno nuevo con la misma identidad pero expiración fresca, y con el
 * rol re-leído desde la base de datos (por si un admin lo cambió mientras
 * tanto — por ejemplo, ascendió a este usuario de employee a admin).
 *
 * Nota de diseño: esto es más simple que un sistema de refresh-token con
 * cookie httpOnly separada y tabla de revocación. Para el tamaño de este
 * negocio es un tradeoff razonable — se puede reforzar más adelante si
 * hace falta invalidar sesiones de forma remota.
 */
import { supabase }               from '../_supabase.js';
import { requireAuth, signToken } from '../_middleware.js';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', req.user.sub)
    .maybeSingle();

  if (error || !data) {
    return res.status(401).json({ error: 'Usuario no encontrado.' });
  }
  if (data.is_active === false) {
    return res.status(403).json({ error: 'Esta cuenta fue desactivada.' });
  }

  const token = signToken({
    id:       data.id,
    role:     data.role,
    store_id: data.store_id,
    email:    data.email,
    name:     data.name,
  });

  return res.status(200).json({ token });
}

export default requireAuth(handler);
