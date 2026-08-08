/**
 * PATCH  /api/customers/:id → actualizar (staff).
 * DELETE /api/customers/:id → eliminar (staff).
 */
import { supabase }     from '../_supabase.js';
import { requireStaff } from '../_middleware.js';
import { mapCustomer }  from '../_mappers.js';

const STORE_ID = process.env.SUPABASE_STORE_ID;

const FIELD_MAP = {
  name: 'name', phone: 'phone', address: 'address',
  email: 'email', isWholesale: 'is_wholesale', notes: 'notes',
};

async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'PATCH') {
    const update = {};
    for (const [key, col] of Object.entries(FIELD_MAP)) {
      if (key in (req.body || {})) update[col] = req.body[key];
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'No se envió ningún campo válido para actualizar.' });
    }

    const { data, error } = await supabase
      .from('customers').update(update)
      .eq('store_id', STORE_ID).eq('id', id)
      .select().single();

    if (error) return res.status(500).json({ error: 'Error al actualizar el cliente.' });
    return res.status(200).json(mapCustomer(data));
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase
      .from('customers').delete()
      .eq('store_id', STORE_ID).eq('id', id);

    if (error) return res.status(500).json({ error: 'Error al eliminar el cliente.' });
    return res.status(204).end();
  }

  return res.status(405).json({ error: 'Método no permitido.' });
}

export default requireStaff(handler);
