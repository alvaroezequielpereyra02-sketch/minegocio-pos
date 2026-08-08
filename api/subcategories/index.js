/**
 * GET  /api/subcategories → lista (público).
 * POST /api/subcategories → crear (admin). Body: { categoryId, name }.
 */
import { supabase }       from '../_supabase.js';
import { requireAdmin }   from '../_middleware.js';
import { mapSubcategory } from '../_mappers.js';

const STORE_ID = process.env.SUPABASE_STORE_ID;

async function listHandler(req, res) {
  let q = supabase.from('subcategories').select('*').eq('store_id', STORE_ID);
  if (req.query.category) q = q.eq('category_id', req.query.category);

  const { data, error } = await q.order('sort_order').order('name');
  if (error) return res.status(500).json({ error: 'Error al listar subcategorías.' });
  return res.status(200).json(data.map(mapSubcategory));
}

async function createHandler(req, res) {
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

export default async function handler(req, res) {
  if (req.method === 'GET')  return listHandler(req, res);
  if (req.method === 'POST') return requireAdmin(createHandler)(req, res);
  return res.status(405).json({ error: 'Método no permitido.' });
}
