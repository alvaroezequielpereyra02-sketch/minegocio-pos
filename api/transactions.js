/**
 * api/transactions.js
 *
 * Checkout y gestión de ventas/pedidos. El archivo más sensible de la
 * migración — toca stock real y plata real.
 *
 * URLs:
 *   GET    /api/transactions                lista (admin/employee: todas; client: solo las propias)
 *   POST   /api/transactions                checkout — crea la venta, descuenta stock, actualiza cliente
 *   PATCH  /api/transactions?id=xxx         actualizar (status simple, o edición completa con reversión de stock)
 *   DELETE /api/transactions?id=xxx         eliminar (admin) — revierte stock
 *
 * Nota de diseño: cada paso (insertar venta, insertar ítems, descontar
 * stock de cada producto, actualizar cliente) se hace en secuencia, no
 * dentro de una transacción SQL atómica — mismo criterio ya usado en
 * products.js (register-faulty, bulk-price-update). Para el volumen de
 * este negocio el riesgo de una falla a mitad de camino es bajo, y queda
 * documentado acá por si en el futuro se quiere reforzar con una función
 * de Postgres.
 */
import { supabase }     from '../lib/supabase.js';
import { requireAuth, requireStaff, requireAdmin } from '../lib/middleware.js';
import { mapTransaction } from '../lib/mappers.js';

const STORE_ID = process.env.SUPABASE_STORE_ID;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fetchItemsFor(transactionIds) {
  if (transactionIds.length === 0) return {};
  const { data, error } = await supabase
    .from('transaction_items').select('*')
    .in('transaction_id', transactionIds);
  if (error) throw error;

  const byTransaction = {};
  for (const item of data) {
    (byTransaction[item.transaction_id] ??= []).push(item);
  }
  return byTransaction;
}

async function adjustStock(productId, delta) {
  if (!productId) return;
  const { data: product } = await supabase
    .from('products').select('stock').eq('store_id', STORE_ID).eq('id', productId).maybeSingle();
  if (!product) return; // producto borrado desde entonces — no hay stock que ajustar
  await supabase
    .from('products').update({ stock: Number(product.stock) + delta })
    .eq('store_id', STORE_ID).eq('id', productId);
}

// ── GET /api/transactions ───────────────────────────────────────────────────

async function listHandler(req, res) {
  let q = supabase.from('transactions').select('*').eq('store_id', STORE_ID);

  if (req.user.role === 'client') {
    q = q.eq('client_id', req.user.sub);
  }
  if (req.query.from) q = q.gte('created_at', req.query.from);
  if (req.query.to)   q = q.lte('created_at', req.query.to);

  const limit = req.user.role === 'client' ? 100 : 1000;
  const { data: transactions, error } = await q.order('created_at', { ascending: false }).limit(limit);
  if (error) return res.status(500).json({ error: 'Error al listar transacciones.' });

  const itemsByTransaction = await fetchItemsFor(transactions.map(t => t.id));
  return res.status(200).json(
    transactions.map(t => mapTransaction(t, itemsByTransaction[t.id] || []))
  );
}

// ── POST /api/transactions (checkout) ───────────────────────────────────────

async function createHandler(req, res) {
  const body = req.body || {};
  const items = Array.isArray(body.items) ? body.items : [];

  if (items.length === 0 || !(Number(body.total) > 0)) {
    return res.status(400).json({ error: 'El pedido necesita al menos un ítem y un total mayor a cero.' });
  }

  // ── Resolver quién es el cliente de esta venta ──
  let clientRole = 'guest';
  let clientId = null;
  let clientName = body.clientName || null;
  let clientAddress = body.clientAddress || null;
  let clientPhone = body.clientPhone || null;

  if (req.user.role === 'client') {
    // Autocheckout: el propio cliente logueado compra para sí mismo.
    const { data: me } = await supabase
      .from('users').select('name, address, phone').eq('id', req.user.sub).maybeSingle();
    clientRole = 'client';
    clientId = req.user.sub;
    clientName = me?.name || clientName;
    clientAddress = me?.address || clientAddress;
    clientPhone = me?.phone || clientPhone;
  } else if (body.customerId) {
    // Venta de mostrador asignada a alguien de la libreta del POS.
    const { data: customer } = await supabase
      .from('customers').select('name, address, phone')
      .eq('store_id', STORE_ID).eq('id', body.customerId).maybeSingle();
    if (customer) {
      clientRole = 'customer';
      clientId = body.customerId;
      clientName = customer.name;
      clientAddress = customer.address;
      clientPhone = customer.phone;
    }
  }

  // ── Crear la transacción ──
  const { data: transaction, error: txErr } = await supabase
    .from('transactions')
    .insert({
      store_id: STORE_ID, type: 'sale',
      total: body.total, amount_paid: body.amountPaid ?? body.total,
      payment_method: body.paymentMethod || null,
      payment_status: body.paymentStatus || 'pending',
      fulfillment_status: 'pending',
      delivery_type: body.deliveryType || 'delivery',
      client_id: clientId, client_role: clientRole,
      client_name: clientName, client_address: clientAddress, client_phone: clientPhone,
      seller_id: req.user.sub, notes: body.notes || null,
    })
    .select().single();

  if (txErr) return res.status(500).json({ error: 'Error al crear la venta.' });

  // ── Ítems ──
  const itemRows = items.map(item => ({
    transaction_id: transaction.id,
    product_id:     item.productId || null,
    variant_id:     item.variantId || null,
    category_id:    item.categoryId || null,
    name:           item.name,
    qty:            item.qty,
    price:          item.price,
    original_price: item.originalPrice ?? null,
    cost:           item.cost || 0,
    offer_id:       item.offerId || null,
    is_wholesale:   !!item.isWholesale,
  }));

  const { error: itemsErr } = await supabase.from('transaction_items').insert(itemRows);
  if (itemsErr) {
    // Si los ítems no se pudieron guardar, no dejamos una venta fantasma
    // con total pero sin productos — se borra la transacción y se avisa
    // el error real, en vez de devolver éxito con un log que nadie ve.
    console.error('[transactions/create] Fallo al insertar ítems, revirtiendo:', itemsErr.message);
    await supabase.from('transactions').delete().eq('id', transaction.id);
    return res.status(500).json({ error: `No se pudieron guardar los productos de la venta: ${itemsErr.message}` });
  }

  // ── Descontar stock (puede ir a negativo — el negocio opera por demanda) ──
  for (const item of items) {
    if (item.productId) await adjustStock(item.productId, -Number(item.qty));
  }

  // ── Estadísticas del cliente, si vino de la libreta del POS ──
  if (clientRole === 'customer' && clientId) {
    const { data: current } = await supabase
      .from('customers').select('orders_count').eq('id', clientId).maybeSingle();
    await supabase
      .from('customers')
      .update({
        orders_count: (current?.orders_count || 0) + 1,
        last_purchase_at: new Date().toISOString(),
      })
      .eq('id', clientId);
  }

  return res.status(201).json(mapTransaction(transaction, itemRows));
}

// ── PATCH /api/transactions?id=xxx ──────────────────────────────────────────

const SIMPLE_FIELD_MAP = {
  status: 'fulfillment_status', paymentStatus: 'payment_status',
  amountPaid: 'amount_paid', paymentMethod: 'payment_method', notes: 'notes',
};

async function updateHandler(req, res, id) {
  const body = req.body || {};

  const { data: existing, error: findErr } = await supabase
    .from('transactions').select('*').eq('store_id', STORE_ID).eq('id', id).maybeSingle();
  if (findErr) return res.status(500).json({ error: 'Error al buscar la transacción.' });
  if (!existing) return res.status(404).json({ error: 'Transacción no encontrada.' });

  // ── Modo A: edición completa de ítems (revierte y reaplica stock) ──
  if (Array.isArray(body.items)) {
    if (body.items.length === 0 && !(Number(body.total) > 0)) {
      return res.status(400).json({ error: 'No se puede guardar una boleta vacía.' });
    }

    const { data: oldItems } = await supabase
      .from('transaction_items').select('*').eq('transaction_id', id);

    for (const item of (oldItems || [])) {
      if (item.product_id) await adjustStock(item.product_id, Number(item.qty)); // revertir
    }

    await supabase.from('transaction_items').delete().eq('transaction_id', id);

    const newItemRows = body.items.map(item => ({
      transaction_id: id,
      product_id:     item.productId || null,
      variant_id:     item.variantId || null,
      category_id:    item.categoryId || null,
      name:           item.name,
      qty:            item.qty,
      price:          item.price,
      original_price: item.originalPrice ?? null,
      cost:           item.cost || 0,
      offer_id:       item.offerId || null,
      is_wholesale:   !!item.isWholesale,
    }));
    await supabase.from('transaction_items').insert(newItemRows);

    for (const item of body.items) {
      if (item.productId) await adjustStock(item.productId, -Number(item.qty)); // reaplicar
    }
  }

  // ── Campos simples ──
  const update = {};
  for (const [key, col] of Object.entries(SIMPLE_FIELD_MAP)) {
    if (key in body) update[col] = body[key];
  }
  if ('total' in body) update.total = body.total;

  if (Object.keys(update).length > 0) {
    const { error: updateErr } = await supabase
      .from('transactions').update(update).eq('store_id', STORE_ID).eq('id', id);
    if (updateErr) return res.status(500).json({ error: 'Error al actualizar la transacción.' });
  }

  const { data: updated } = await supabase
    .from('transactions').select('*').eq('id', id).maybeSingle();
  const { data: items } = await supabase
    .from('transaction_items').select('*').eq('transaction_id', id);

  return res.status(200).json(mapTransaction(updated, items || []));
}

// ── DELETE /api/transactions?id=xxx ─────────────────────────────────────────

async function deleteHandler(req, res, id) {
  const { data: items } = await supabase
    .from('transaction_items').select('*').eq('transaction_id', id);

  for (const item of (items || [])) {
    if (item.product_id) await adjustStock(item.product_id, Number(item.qty)); // revertir stock
  }

  const { error } = await supabase
    .from('transactions').delete().eq('store_id', STORE_ID).eq('id', id);
  if (error) return res.status(500).json({ error: 'Error al eliminar la transacción.' });

  return res.status(204).end();
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const { id } = req.query;

  if (id) {
    if (req.method === 'PATCH')  return requireStaff((r, s) => updateHandler(r, s, id))(req, res);
    if (req.method === 'DELETE') return requireAdmin((r, s) => deleteHandler(r, s, id))(req, res);
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  if (req.method === 'GET')  return requireAuth(listHandler)(req, res);
  if (req.method === 'POST') return requireAuth(createHandler)(req, res);

  return res.status(405).json({ error: 'Método no permitido.' });
}
