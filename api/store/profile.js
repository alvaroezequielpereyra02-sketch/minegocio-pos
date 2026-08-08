/**
 * GET   /api/store/profile → datos públicos de la tienda (nombre, logo).
 *                             SIN autenticación — la pantalla de login y el
 *                             futuro catálogo público lo necesitan antes de
 *                             que la persona inicie sesión.
 * PATCH /api/store/profile → actualizar (admin).
 */
import { supabase }     from '../_supabase.js';
import { requireAdmin } from '../_middleware.js';
import { mapStore }     from '../_mappers.js';

const STORE_ID = process.env.SUPABASE_STORE_ID;

async function getHandler(req, res) {
  const { data, error } = await supabase
    .from('stores').select('id, slug, name, logo_url, address, phone, email, currency, config')
    .eq('id', STORE_ID).maybeSingle();

  if (error) return res.status(500).json({ error: 'Error al obtener el perfil de la tienda.' });
  if (!data)  return res.status(404).json({ error: 'Tienda no encontrada.' });
  return res.status(200).json(mapStore(data));
}

async function patchHandler(req, res) {
  const update = {};
  const body = req.body || {};
  if ('name'    in body) update.name     = body.name;
  if ('logoUrl' in body) update.logo_url = body.logoUrl;
  if ('address' in body) update.address  = body.address;
  if ('phone'   in body) update.phone    = body.phone;
  if ('email'   in body) update.email    = body.email;
  if ('config'  in body) update.config   = body.config;

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ error: 'No se envió ningún campo válido para actualizar.' });
  }

  const { data, error } = await supabase
    .from('stores').update(update)
    .eq('id', STORE_ID)
    .select().single();

  if (error) return res.status(500).json({ error: 'Error al actualizar la tienda.' });
  return res.status(200).json(mapStore(data));
}

export default async function handler(req, res) {
  if (req.method === 'GET')   return getHandler(req, res);
  if (req.method === 'PATCH') return requireAdmin(patchHandler)(req, res);
  return res.status(405).json({ error: 'Método no permitido.' });
}
