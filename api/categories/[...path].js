/**
 * api/categories/[...path].js
 *
 * Consolida el detalle de categoría Y todas las subcategorías en un solo
 * archivo — antes eran 3 (categories/[id].js, subcategories/index.js,
 * subcategories/[id].js). `api/categories/index.js` (listar/crear
 * categorías) queda aparte porque no tiene :id.
 *
 * Esto SÍ cambia las URLs de subcategorías (antes vivían en /api/subcategories,
 * ahora en /api/categories/subcategories) — es el único jeito de que un solo
 * archivo físico cubra ambos recursos, dada la forma en que Vercel enruta por
 * carpetas. El frontend (src/services/categories.js) ya está actualizado
 * para llamar a las rutas nuevas.
 *
 * Rutas que cubre este archivo:
 *   PATCH  /api/categories/:id
 *   DELETE /api/categories/:id
 *   GET    /api/categories/subcategories
 *   POST   /api/categories/subcategories
 *   DELETE /api/categories/subcategories/:id
 */
import { supabase }     from '../../lib/supabase.js';
import { requireAdmin } from '../../lib/middleware.js';
import { mapCategory, mapSubcategory } from '../../lib/mappers.js';

const STORE_ID = process.env.SUPABASE_STORE_ID;

// ── PATCH/DELETE /api/categories/:id ────────────────────────────────────────

async function categoryDetailHandler(req, res, id) {
  if (req.method === 'PATCH') {
    const name = (req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio.' });

    const { data, error } = await supabase
      .from('categories').update({ name })
      .eq('store_id', STORE_ID).eq('id', id).select().single();

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
      return res.status(409).json({ error: `No se puede borrar: ${count} producto(s) usan esta categoría.` });
    }

    const { error } = await supabase
      .from('categories').delete()
      .eq('store_id', STORE_ID).eq('id', id);

    if (error) return res.status(500).json({ error: 'Error al eliminar la categoría.' });
    return res.status(204).end();
  }

  return res.status(405).json({ error: 'Método no permitido.' });
}

// ── GET/POST /api/categories/subcategories ──────────────────────────────────

async function subcategoriesListHandler(req, res) {
  if (req.method === 'GET') {
    let q = supabase.from('subcategories').select('*').eq('store_id', STORE_ID);
    if (req.query.category) q = q.eq('category_id', req.query.category);

    const { data, error } = await q.order('sort_order').order('name');
    if (error) return res.status(500).json({ error: 'Error al listar subcategorías.' });
    return res.status(200).json(data.map(mapSubcategory));
  }

  if (req.method === 'POST') {
    const name       = (req.body?.name || '').trim();
    const categoryId = req.body?.categoryId;
    if (!name)       return res.status(400).json({ error: 'El nombre es obligatorio.' });
    if (!categoryId) return res.status(400).json({ error: 'categoryId es obligatorio.' });

    const { data, error } = await supabase
      .from('subcategories')
      .insert({ store_id: STORE_ID, category_id: categoryId, name })
      .select().single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Ya existe esa subcategoría en esta categoría.' });
      return res.status(500).json({ error: 'Error al crear la subcategoría.' });
    }
    return res.status(201).json(mapSubcategory(data));
  }

  return res.status(405).json({ error: 'Método no permitido.' });
}

// ── DELETE /api/categories/subcategories/:id ────────────────────────────────

async function subcategoryDeleteHandler(req, res, id) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Método no permitido.' });

  const { error } = await supabase
    .from('subcategories').delete()
    .eq('store_id', STORE_ID).eq('id', id);

  if (error) return res.status(500).json({ error: 'Error al eliminar la subcategoría.' });
  return res.status(204).end();
}

// ── Dispatcher ───────────────────────────────────────────────────────────────
//
// requireAdmin se aplica por ruta, no a todo el archivo — el GET de
// subcategorías era público en el diseño original (el catálogo público de
// la Fase 2B lo va a necesitar sin login) y hay que mantenerlo así.

export default async function handler(req, res) {
  const path = Array.isArray(req.query.path) ? req.query.path : [];
  const [seg0, seg1] = path;

  if (seg0 === 'subcategories' && !seg1) {
    if (req.method === 'GET') return subcategoriesListHandler(req, res); // público
    return requireAdmin(subcategoriesListHandler)(req, res);             // POST → admin
  }
  if (seg0 === 'subcategories' && seg1) {
    return requireAdmin((r, s) => subcategoryDeleteHandler(r, s, seg1))(req, res);
  }
  if (seg0 && !seg1) {
    return requireAdmin((r, s) => categoryDetailHandler(r, s, seg0))(req, res);
  }

  return res.status(404).json({ error: 'Ruta no encontrada.' });
}
