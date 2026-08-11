/**
 * api/products.js
 *
 * Reemplaza api/products/index.js + api/products/[...path].js. Mismo
 * motivo que api/auth.js: un archivo concreto con `?id=` y `?action=` en
 * vez de rutas dinámicas, que no se estaban reconociendo de forma
 * confiable en este proyecto.
 *
 * URLs:
 *   GET    /api/products                          lista (pública si no hay sesión de staff)
 *   POST   /api/products                           crear (admin)
 *   GET    /api/products?id=xxx                    un producto (staff)
 *   PATCH  /api/products?id=xxx                    actualizar (admin: todo / employee: solo stock)
 *   DELETE /api/products?id=xxx                    soft-delete (admin)
 *   POST   /api/products?id=xxx&action=add-stock          sumar stock (staff)
 *   POST   /api/products?id=xxx&action=register-faulty    registrar fallado (staff)
 *   POST   /api/products?action=bulk-price-update          ajuste masivo (admin)
 */
import { supabase }     from '../lib/supabase.js';
import { requireStaff, requireAdmin } from '../lib/middleware.js';
import { mapProduct }   from '../lib/mappers.js';
import jwt               from 'jsonwebtoken';

const STORE_ID = process.env.SUPABASE_STORE_ID;

function tryGetUser(req) {
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

// ── GET /api/products (lista) ───────────────────────────────────────────────

async function listHandler(req, res) {
  const user = tryGetUser(req);
  const isStaff = user && ['admin', 'employee'].includes(user.role);

  let q = supabase.from('products').select('*').eq('store_id', STORE_ID);

  if (isStaff) {
    if (req.query.includeInactive !== '1') q = q.eq('is_active', true);
  } else {
    q = q.eq('is_active', true).eq('is_public', true);
  }

  if (req.query.category)    q = q.eq('category_id', req.query.category);
  if (req.query.subcategory) q = q.eq('subcategory_id', req.query.subcategory);
  if (req.query.search)      q = q.ilike('name', `%${req.query.search}%`);

  const { data, error } = await q.order('name').limit(1000);
  if (error) return res.status(500).json({ error: 'Error al listar productos.' });

  return res.status(200).json(data.map(mapProduct));
}

// ── POST /api/products (crear) ──────────────────────────────────────────────

async function createHandler(req, res) {
  const body = req.body || {};
  if (!body.name || typeof body.name !== 'string') {
    return res.status(400).json({ error: 'El nombre del producto es obligatorio.' });
  }

  const { data, error } = await supabase
    .from('products')
    .insert({
      store_id: STORE_ID,
      name: body.name, description: body.description || null, barcode: body.barcode || null,
      category_id: body.categoryId || null, subcategory_id: body.subcategoryId || null,
      price: body.price || 0, wholesale_price: body.wholesalePrice ?? null, cost: body.cost || 0,
      stock: body.stock || 0, min_stock: body.minStock || 0, unit: body.unit || 'unidad',
      images: body.images || (body.imageUrl ? [body.imageUrl] : []),
      is_public: body.isPublic ?? true,
    })
    .select().single();

  if (error) return res.status(500).json({ error: 'Error al crear el producto.' });
  return res.status(201).json(mapProduct(data));
}

// ── GET/PATCH/DELETE /api/products?id=xxx ───────────────────────────────────

const EMPLOYEE_ALLOWED_FIELDS = ['stock'];
const FIELD_MAP = {
  name: 'name', description: 'description', barcode: 'barcode',
  categoryId: 'category_id', subcategoryId: 'subcategory_id',
  price: 'price', wholesalePrice: 'wholesale_price', cost: 'cost',
  stock: 'stock', minStock: 'min_stock', unit: 'unit',
  images: 'images', isActive: 'is_active', isPublic: 'is_public',
};

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
    if ('imageUrl' in body) update.images = body.imageUrl ? [body.imageUrl] : [];
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

// ── POST /api/products?id=xxx&action=add-stock ──────────────────────────────

async function addStockHandler(req, res, id) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });

  const qty = Number(req.body?.qty);
  if (!qty || Number.isNaN(qty)) return res.status(400).json({ error: 'qty debe ser un número distinto de cero.' });

  const { data: product, error: findErr } = await supabase
    .from('products').select('stock')
    .eq('store_id', STORE_ID).eq('id', id).maybeSingle();
  if (findErr) return res.status(500).json({ error: 'Error al buscar el producto.' });
  if (!product) return res.status(404).json({ error: 'Producto no encontrado.' });

  const { data, error } = await supabase
    .from('products').update({ stock: Number(product.stock) + qty })
    .eq('store_id', STORE_ID).eq('id', id).select().single();

  if (error) return res.status(500).json({ error: 'Error al actualizar el stock.' });
  return res.status(200).json(mapProduct(data));
}

// ── POST /api/products?id=xxx&action=register-faulty ────────────────────────

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
    .from('products').update({ stock: Number(product.stock) - qty })
    .eq('store_id', STORE_ID).eq('id', id).select().single();
  if (updateErr) return res.status(500).json({ error: 'Error al descontar el stock.' });

  const lossAmount = Number(product.cost || 0) * qty;
  const { error: expenseErr } = await supabase.from('expenses').insert({
    store_id: STORE_ID, amount: lossAmount, category: 'inventory_loss',
    description: `PÉRDIDA (Fallado): ${qty}x ${product.name} - ${reason || 'Sin motivo'}`,
    date: new Date().toISOString().slice(0, 10), created_by: req.user.sub,
  });
  if (expenseErr) console.error('[register-faulty] Stock descontado pero el gasto no se registró:', expenseErr.message);

  return res.status(200).json(mapProduct(updated));
}

// ── POST /api/products?action=bulk-price-update ─────────────────────────────

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
    // sin filtro
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
    const { error } = await supabase.from('products').update(payload).eq('store_id', STORE_ID).eq('id', p.id);
    if (!error) updated++;
  }

  return res.status(200).json({ updated });
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const { id, action } = req.query;

  if (action === 'bulk-price-update') return requireAdmin(bulkPriceHandler)(req, res);
  if (id && action === 'add-stock')        return requireStaff((r, s) => addStockHandler(r, s, id))(req, res);
  if (id && action === 'register-faulty')  return requireStaff((r, s) => registerFaultyHandler(r, s, id))(req, res);
  if (id)                                  return requireStaff((r, s) => detailHandler(r, s, id))(req, res);

  if (req.method === 'GET')  return listHandler(req, res);
  if (req.method === 'POST') return requireAdmin(createHandler)(req, res);

  return res.status(405).json({ error: 'Método no permitido.' });
}
