/**
 * GET /api/auth/me
 *
 * Devuelve el perfil completo y actualizado del usuario autenticado,
 * leído fresco desde la base de datos (no del JWT, que puede tener
 * datos viejos si el rol cambió recientemente).
 *
 * El frontend llama esto al cargar la app y al volver a la pestaña,
 * para tener el rol y profile_complete siempre al día.
 */
import { supabase }    from '../../_supabase.js';
import { requireAuth } from '../../_middleware.js';
import { mapUser }     from '../../_mappers.js';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', req.user.sub)
    .maybeSingle();

  if (error) return res.status(500).json({ error: 'Error al obtener el perfil.' });
  if (!data)  return res.status(404).json({ error: 'Usuario no encontrado.' });
  if (data.is_active === false) {
    return res.status(403).json({ error: 'Esta cuenta fue desactivada.' });
  }

  return res.status(200).json(mapUser(data));
}

export default requireAuth(handler);
