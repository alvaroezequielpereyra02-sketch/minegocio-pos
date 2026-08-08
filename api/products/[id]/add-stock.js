/**
 * POST /api/products/:id/add-stock
 * Body: { qty: number }
 *
 * Suma `qty` al stock actual (puede ser negativo el resultado final — el
 * negocio opera por demanda, un stock en negativo es una señal de "falta
 * reponer", no un error). Admin y employee.
 */
import { supabase }     from '../../_supabase.js';
import { requireStaff } from '../../_middleware.js';
import { mapProduct }   from '../../_mappers.js';

const STORE_ID = process.env.SUPABASE_STORE_ID;

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const { id } = req.query;
  const qty = Number(req.body?.qty);

  if (!qty || Number.isNaN(qty)) {
    return res.status(400).json({ error: 'qty debe ser un número distinto de cero.' });
  }

  const { data: product, error: findErr } = await supabase
    .from('products').select('stock')
    .eq('store_id', STORE_ID).eq('id', id).maybeSingle();

  if (findErr) return res.status(500).json({ error: 'Error al buscar el producto.' });
  if (!product) return res.status(404).json({ error: 'Producto no encontrado.' });

  const { data, error } = await supabase
    .from('products')
    .update({ stock: Number(product.stock) + qty })
    .eq('store_id', STORE_ID).eq('id', id)
    .select().single();

  if (error) return res.status(500).json({ error: 'Error al actualizar el stock.' });
  return res.status(200).json(mapProduct(data));
}

export default requireStaff(handler);
