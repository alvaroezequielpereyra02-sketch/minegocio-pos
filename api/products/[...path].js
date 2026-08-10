/**
 * api/products/[...path].js
 *
 * Consolida las rutas de producto que dependen de un :id — antes eran 4
 * archivos separados ([id].js, [id]/add-stock.js, [id]/register-faulty.js,
 * bulk-price-update.js). `api/products/index.js` (listar/crear) queda
 * como archivo aparte porque no tiene :id — no hay pérdida de rutas, solo
 * de cantidad de archivos físicos (para el límite de 12 funciones de Vercel).
 *
 * Rutas que cubre este archivo:
 *   GET    /api/products/:id
 *   PATCH  /api/products/:id
 *   DELETE /api/products/:id
 *   POST   /api/products/:id/add-stock
 *   POST   /api/products/:id/register-faulty
 *   POST   /api/products/bulk-price-update
 */
import { supabase }     from '../../lib/supabase.js';
import { requireStaff, requireAdmin } from '../../lib/middleware.js';
import { mapProduct }   from '../../lib/mappers.js';

const STORE_ID = process.env.SUPABASE_STORE_ID;

const EMPLOYEE_ALLOWED_FIELDS = ['stock'];

const FIELD_MAP = {
  name: 'name', description: 'description', barcode: 'barcode',
  categoryId: 'category_id', subcategoryId: 'subcategory_id',
  price: 'price', wholesalePrice: 'wholesale_price', cost: 'cost',
  stock: 'stock', minStock: 'min_stock', unit: 'unit',
  images: 'images', isActive: 'is_active', isPublic: 'is_public',
};

// ── GET/PATCH/DELETE /api/products/:id ──────────────────────────────────────

async function detailHandler(req, res, id) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('products').select('*')
      .eq('store_id', STORE_ID).eq('id', id).maybeSingle();
    if (error) return res.status(500).json({ error: 'Error al buscar el producto.' });
    if (!data)  return res.status(404).json({ error: 'Producto no encontrado.' });
    return res.status(200).json(mapProduct(data));
  }

  if (req.method === 'PATCH') {
    const body = req.body || {};
    const keys = Object.keys(body);

    if (req.user.role !== 'admin') {
      const invalid = keys.filter(k => !EMPLOYEE_ALLOWED_FIELDS.includes(k));
      if (invalid.length > 0) {
        return res.status(403).json({ error: 'Como empleado, solo podés actualizar el stock de un producto.' });
      }
    }

    const update = {};
    for (const key of keys) {
      if (FIELD_MAP[key]) update[FIELD_MAP[key]] = body[key];
    }
    if ('imageUrl' in body) {
      update.images = body.imageUrl ? [body.imageUrl] : [];
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'No se envió ningún campo válido para actualizar.' });
    }

    const { data, error } = await supabase
      .from('products').update(update)
      .eq('store_id', STORE_ID).eq('id', id).select().single();

    if (error) return res.status(500).json({ error: 'Error al actualizar el producto.' });
    return res.status(200).json(mapProduct(data));
  }

  if (req.method === 'DELETE') {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo un admin puede eliminar productos.' });
    }
    const { error } = await supabase
      .from('products').update({ is_active: false })
      .eq('store_id', STORE_ID).eq('id', id);
    if (error) return res.status(500).json({ error: 'Error al eliminar el producto.' });
    return res.status(204).end();
  }

  return res.status(405).json({ error: 'Método no permitido.' });
}

// ── POST /api/products/:id/add-stock ────────────────────────────────────────

async function addStockHandler(req, res, id) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });

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
    .eq('store_id', STORE_ID).eq('id', id).select().single();

  if (error) return res.status(500).json({ error: 'Error al actualizar el stock.' });
  return res.status(200).json(mapProduct(data));
}

// ── POST /api/products/:id/register-faulty ──────────────────────────────────

async function registerFaultyHandler(req, res, id) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });

  const qty    = Number(req.body?.qty);
  const reason = (req.body?.reason || '').trim();
  if (!qty || qty <= 0) return res.status(400).json({ error: 'qty debe ser un número mayor a cero.' });

  const { data: product, error: findErr } = await supabase
    .from('products').select('*')
    .eq('store_id', STORE_ID).eq('id', id).maybeSingle();
  if (findErr) return res.status(500).json({ error: 'Error al buscar el producto.' });
  if (!product) return res.status(404).json({ error: 'Producto no encontrado.' });

  const { data: updated, error: updateErr } = await supabase
    .from('products')
    .update({ stock: Number(product.stock) - qty })
    .eq('store_id', STORE_ID).eq('id', id).select().single();
  if (updateErr) return res.status(500).json({ error: 'Error al descontar el stock.' });

  const lossAmount = Number(product.cost || 0) * qty;
  const { error: expenseErr } = await supabase.from('expenses').insert({
    store_id: STORE_ID, amount: lossAmount, category: 'inventory_loss',
    description: `PÉRDIDA (Fallado): ${qty}x ${product.name} - ${reason || 'Sin motivo'}`,
    date: new Date().toISOString().slice(0, 10), created_by: req.user.sub,
  });
  if (expenseErr) {
    console.error('[register-faulty] El stock se descontó pero el gasto no se pudo registrar:', expenseErr.message);
  }

  return res.status(200).json(mapProduct(updated));
}

// ── POST /api/products/bulk-price-update ────────────────────────────────────

function round(n, roundTo) {
  if (!roundTo || roundTo <= 0) return Math.round(n);
  return Math.round(n / roundTo) * roundTo;
}

async function bulkPriceHandler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });

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

// ── Dispatcher ───────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const path = Array.isArray(req.query.path) ? req.query.path : [];
  const [seg0, seg1] = path;

  if (seg0 === 'bulk-price-update') return requireAdmin(bulkPriceHandler)(req, res);
  if (seg0 && seg1 === 'add-stock')        return requireStaff((r, s) => addStockHandler(r, s, seg0))(req, res);
  if (seg0 && seg1 === 'register-faulty')  return requireStaff((r, s) => registerFaultyHandler(r, s, seg0))(req, res);
  if (seg0 && !seg1)                       return requireStaff((r, s) => detailHandler(r, s, seg0))(req, res);

  return res.status(404).json({ error: 'Ruta no encontrada.' });
}
