/**
 * POST /api/products/:id/register-faulty
 * Body: { qty: number, reason?: string }
 *
 * Registra unidades falladas/dañadas: resta stock y crea un gasto de tipo
 * "inventory_loss" por el costo de esas unidades. Reemplaza el writeBatch
 * atómico de Firestore — acá se hacen las dos escrituras en secuencia; si la
 * segunda falla, el stock ya quedó descontado (caso borde poco probable,
 * pero documentado por si hace falta un ajuste manual).
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
  const qty    = Number(req.body?.qty);
  const reason = (req.body?.reason || '').trim();

  if (!qty || qty <= 0) {
    return res.status(400).json({ error: 'qty debe ser un número mayor a cero.' });
  }

  const { data: product, error: findErr } = await supabase
    .from('products').select('*')
    .eq('store_id', STORE_ID).eq('id', id).maybeSingle();

  if (findErr) return res.status(500).json({ error: 'Error al buscar el producto.' });
  if (!product) return res.status(404).json({ error: 'Producto no encontrado.' });

  const { data: updated, error: updateErr } = await supabase
    .from('products')
    .update({ stock: Number(product.stock) - qty })
    .eq('store_id', STORE_ID).eq('id', id)
    .select().single();

  if (updateErr) return res.status(500).json({ error: 'Error al descontar el stock.' });

  const lossAmount = Number(product.cost || 0) * qty;
  const { error: expenseErr } = await supabase.from('expenses').insert({
    store_id:    STORE_ID,
    amount:      lossAmount,
    category:    'inventory_loss',
    description: `PÉRDIDA (Fallado): ${qty}x ${product.name} - ${reason || 'Sin motivo'}`,
    date:        new Date().toISOString().slice(0, 10),
    created_by:  req.user.sub,
  });

  if (expenseErr) {
    console.error('[register-faulty] El stock se descontó pero el gasto no se pudo registrar:', expenseErr.message);
  }

  return res.status(200).json(mapProduct(updated));
}

export default requireStaff(handler);
