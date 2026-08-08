/**
 * DELETE /api/subcategories/:id (admin).
 */
import { supabase }     from '../_supabase.js';
import { requireAdmin } from '../_middleware.js';

const STORE_ID = process.env.SUPABASE_STORE_ID;

async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const { id } = req.query;
  const { error } = await supabase
    .from('subcategories').delete()
    .eq('store_id', STORE_ID).eq('id', id);

  if (error) return res.status(500).json({ error: 'Error al eliminar la subcategoría.' });
  return res.status(204).end();
}

export default requireAdmin(handler);
