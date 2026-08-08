/**
 * GET  /api/categories → lista (público, sin login — se necesita para el
 *                          catálogo público y para armar filtros en el POS).
 * POST /api/categories → crear (admin).
 */
import { supabase }     from '../_supabase.js';
import { requireAdmin } from '../_middleware.js';
import { mapCategory }  from '../_mappers.js';

const STORE_ID = process.env.SUPABASE_STORE_ID;

async function listHandler(req, res) {
  const { data, error } = await supabase
    .from('categories').select('*')
    .eq('store_id', STORE_ID)
    .order('sort_order').order('name');

  if (error) return res.status(500).json({ error: 'Error al listar categorías.' });
  return res.status(200).json(data.map(mapCategory));
}

async function createHandler(req, res) {
  const name = (req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'El nombre es obligatorio.' });

  const { data, error } = await supabase
    .from('categories')
    .insert({ store_id: STORE_ID, name })
    .select().single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Ya existe una categoría con ese nombre.' });
    return res.status(500).json({ error: 'Error al crear la categoría.' });
  }
  return res.status(201).json(mapCategory(data));
}

export default async function handler(req, res) {
  if (req.method === 'GET')  return listHandler(req, res);
  if (req.method === 'POST') return requireAdmin(createHandler)(req, res);
  return res.status(405).json({ error: 'Método no permitido.' });
}
