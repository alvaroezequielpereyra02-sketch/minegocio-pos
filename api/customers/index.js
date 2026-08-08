/**
 * GET  /api/customers → lista (staff).
 * POST /api/customers → crear (staff).
 *
 * Esta es la libreta de clientes que administra el vendedor a mano para el
 * POS — distinta de los `users` con role='client' que se registran solos
 * con Google desde el catálogo público.
 */
import { supabase }     from '../_supabase.js';
import { requireStaff } from '../_middleware.js';
import { mapCustomer }  from '../_mappers.js';

const STORE_ID = process.env.SUPABASE_STORE_ID;

async function handler(req, res) {
  if (req.method === 'GET') {
    let q = supabase.from('customers').select('*').eq('store_id', STORE_ID);
    if (req.query.search) q = q.ilike('name', `%${req.query.search}%`);

    const { data, error } = await q.order('name').limit(500);
    if (error) return res.status(500).json({ error: 'Error al listar clientes.' });
    return res.status(200).json(data.map(mapCustomer));
  }

  if (req.method === 'POST') {
    const name = (req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio.' });

    const { data, error } = await supabase
      .from('customers')
      .insert({
        store_id:     STORE_ID,
        name,
        phone:        req.body?.phone || null,
        address:      req.body?.address || null,
        email:        req.body?.email || null,
        is_wholesale: !!req.body?.isWholesale,
        notes:        req.body?.notes || null,
      })
      .select().single();

    if (error) return res.status(500).json({ error: 'Error al crear el cliente.' });
    return res.status(201).json(mapCustomer(data));
  }

  return res.status(405).json({ error: 'Método no permitido.' });
}

export default requireStaff(handler);
