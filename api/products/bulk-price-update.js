/**
 * POST /api/products/bulk-price-update
 * Body: { categoryId, type: 'percent'|'fixed', value, field: 'price'|'cost'|'both', roundTo? }
 *
 * categoryId acepta:
 *   '__all__'          → todos los productos
 *   '__sub__:<uuid>'   → productos de esa subcategoría
 *   '<uuid>'           → productos de esa categoría
 *
 * Mantiene la misma convención que tenía el frontend en Firestore para no
 * tener que tocar la UI que arma este payload.
 */
import { supabase }     from '../_supabase.js';
import { requireAdmin } from '../_middleware.js';

const STORE_ID = process.env.SUPABASE_STORE_ID;

function round(n, roundTo) {
  if (!roundTo || roundTo <= 0) return Math.round(n);
  return Math.round(n / roundTo) * roundTo;
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const { categoryId, type, value, field, roundTo = 0 } = req.body || {};

  if (!categoryId || !['percent', 'fixed'].includes(type) || typeof value !== 'number') {
    return res.status(400).json({ error: 'Parámetros inválidos.' });
  }
  if (!['price', 'cost', 'both'].includes(field)) {
    return res.status(400).json({ error: "field debe ser 'price', 'cost' o 'both'." });
  }

  let q = supabase.from('products').select('id, price, cost')
    .eq('store_id', STORE_ID).eq('is_active', true);

  if (categoryId === '__all__') {
    // sin filtro adicional
  } else if (categoryId.startsWith('__sub__:')) {
    q = q.eq('subcategory_id', categoryId.slice(8));
  } else {
    q = q.eq('category_id', categoryId);
  }

  const { data: targets, error: findErr } = await q;
  if (findErr) return res.status(500).json({ error: 'Error al buscar productos.' });
  if (!targets || targets.length === 0) return res.status(200).json({ updated: 0 });

  const applyChange = (current) => {
    const base = Number(current || 0);
    const next = type === 'percent' ? base * (1 + value / 100) : base + value;
    return round(Math.max(0, next), roundTo);
  };

  let updated = 0;
  for (const p of targets) {
    const payload = {};
    if (field === 'price' || field === 'both') payload.price = applyChange(p.price);
    if (field === 'cost'  || field === 'both') payload.cost  = applyChange(p.cost);

    const { error } = await supabase
      .from('products').update(payload)
      .eq('store_id', STORE_ID).eq('id', p.id);

    if (!error) updated++;
  }

  return res.status(200).json({ updated });
}

export default requireAdmin(handler);
