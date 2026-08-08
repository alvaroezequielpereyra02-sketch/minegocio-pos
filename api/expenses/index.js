/**
 * GET  /api/expenses → lista (admin — datos financieros).
 * POST /api/expenses → crear (admin).
 */
import { supabase }     from '../_supabase.js';
import { requireAdmin } from '../_middleware.js';
import { mapExpense }   from '../_mappers.js';

const STORE_ID = process.env.SUPABASE_STORE_ID;

async function handler(req, res) {
  if (req.method === 'GET') {
    let q = supabase.from('expenses').select('*').eq('store_id', STORE_ID);
    if (req.query.from) q = q.gte('date', req.query.from);
    if (req.query.to)   q = q.lte('date', req.query.to);

    const { data, error } = await q.order('date', { ascending: false }).limit(300);
    if (error) return res.status(500).json({ error: 'Error al listar gastos.' });
    return res.status(200).json(data.map(mapExpense));
  }

  if (req.method === 'POST') {
    const amount = Number(req.body?.amount);
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'El monto debe ser un número mayor a cero.' });
    }

    const { data, error } = await supabase
      .from('expenses')
      .insert({
        store_id:    STORE_ID,
        amount,
        category:    req.body?.category || null,
        description: req.body?.description || null,
        date:        req.body?.date || new Date().toISOString().slice(0, 10),
        created_by:  req.user.sub,
      })
      .select().single();

    if (error) return res.status(500).json({ error: 'Error al crear el gasto.' });
    return res.status(201).json(mapExpense(data));
  }

  return res.status(405).json({ error: 'Método no permitido.' });
}

export default requireAdmin(handler);
