/**
 * PATCH  /api/categories/:id → renombrar (admin).
 * DELETE /api/categories/:id → eliminar (admin). Bloqueado si hay productos
 *                               activos usando esta categoría — misma
 *                               protección que tenía el frontend con
 *                               Firestore, movida al backend para que rija
 *                               sin importar desde dónde se llame.
 */
import { supabase }     from '../_supabase.js';
import { requireAdmin } from '../_middleware.js';
import { mapCategory }  from '../_mappers.js';

const STORE_ID = process.env.SUPABASE_STORE_ID;

async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'PATCH') {
    const name = (req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio.' });

    const { data, error } = await supabase
      .from('categories').update({ name })
      .eq('store_id', STORE_ID).eq('id', id)
      .select().single();

    if (error) return res.status(500).json({ error: 'Error al renombrar la categoría.' });
    return res.status(200).json(mapCategory(data));
  }

  if (req.method === 'DELETE') {
    const { count, error: countErr } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', STORE_ID).eq('category_id', id).eq('is_active', true);

    if (countErr) return res.status(500).json({ error: 'Error al verificar productos asociados.' });
    if (count > 0) {
      return res.status(409).json({
        error: `No se puede borrar: ${count} producto(s) usan esta categoría.`,
      });
    }

    const { error } = await supabase
      .from('categories').delete()
      .eq('store_id', STORE_ID).eq('id', id);

    if (error) return res.status(500).json({ error: 'Error al eliminar la categoría.' });
    return res.status(204).end();
  }

  return res.status(405).json({ error: 'Método no permitido.' });
}

export default requireAdmin(handler);
