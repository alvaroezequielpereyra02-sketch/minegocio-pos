/**
 * api/data/[...path].js
 *
 * Consolida clientes (libreta del POS), gastos y perfil de tienda en un
 * solo archivo — antes eran 5 archivos separados (customers/index.js,
 * customers/[id].js, expenses/index.js, expenses/[id].js, store/profile.js).
 * Se agrupan porque son recursos chicos, de bajo tráfico, todos
 * administrativos — juntarlos en un solo "gateway" libera varios cupos del
 * límite de 12 funciones serverless del plan Hobby de Vercel.
 *
 * Esto SÍ cambia las URLs de estos tres recursos:
 *   /api/customers      → /api/data/customers
 *   /api/customers/:id  → /api/data/customers/:id
 *   /api/expenses       → /api/data/expenses
 *   /api/expenses/:id   → /api/data/expenses/:id
 *   /api/store/profile  → /api/data/store-profile
 * El frontend (src/services/customers.js, expenses.js, store.js) ya está
 * actualizado para llamar a las rutas nuevas.
 */
import { supabase }     from '../../lib/supabase.js';
import { requireStaff, requireAdmin } from '../../lib/middleware.js';
import { mapCustomer, mapExpense, mapStore } from '../../lib/mappers.js';

const STORE_ID = process.env.SUPABASE_STORE_ID;

// ── /api/data/customers ──────────────────────────────────────────────────────

async function customersListHandler(req, res) {
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
        store_id: STORE_ID, name,
        phone: req.body?.phone || null, address: req.body?.address || null,
        email: req.body?.email || null, is_wholesale: !!req.body?.isWholesale,
        notes: req.body?.notes || null,
      })
      .select().single();

    if (error) return res.status(500).json({ error: 'Error al crear el cliente.' });
    return res.status(201).json(mapCustomer(data));
  }

  return res.status(405).json({ error: 'Método no permitido.' });
}

const CUSTOMER_FIELD_MAP = {
  name: 'name', phone: 'phone', address: 'address',
  email: 'email', isWholesale: 'is_wholesale', notes: 'notes',
};

async function customerDetailHandler(req, res, id) {
  if (req.method === 'PATCH') {
    const update = {};
    for (const [key, col] of Object.entries(CUSTOMER_FIELD_MAP)) {
      if (key in (req.body || {})) update[col] = req.body[key];
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'No se envió ningún campo válido para actualizar.' });
    }

    const { data, error } = await supabase
      .from('customers').update(update)
      .eq('store_id', STORE_ID).eq('id', id).select().single();

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

// ── /api/data/expenses ────────────────────────────────────────────────────────

async function expensesListHandler(req, res) {
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
        store_id: STORE_ID, amount,
        category: req.body?.category || null, description: req.body?.description || null,
        date: req.body?.date || new Date().toISOString().slice(0, 10),
        created_by: req.user.sub,
      })
      .select().single();

    if (error) return res.status(500).json({ error: 'Error al crear el gasto.' });
    return res.status(201).json(mapExpense(data));
  }

  return res.status(405).json({ error: 'Método no permitido.' });
}

async function expenseDeleteHandler(req, res, id) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Método no permitido.' });

  const { error } = await supabase
    .from('expenses').delete()
    .eq('store_id', STORE_ID).eq('id', id);

  if (error) return res.status(500).json({ error: 'Error al eliminar el gasto.' });
  return res.status(204).end();
}

// ── /api/data/store-profile ─────────────────────────────────────────────────

async function storeProfileGetHandler(req, res) {
  const { data, error } = await supabase
    .from('stores').select('id, slug, name, logo_url, address, phone, email, currency, config')
    .eq('id', STORE_ID).maybeSingle();

  if (error) return res.status(500).json({ error: 'Error al obtener el perfil de la tienda.' });
  if (!data)  return res.status(404).json({ error: 'Tienda no encontrada.' });
  return res.status(200).json(mapStore(data));
}

async function storeProfilePatchHandler(req, res) {
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
    .eq('id', STORE_ID).select().single();

  if (error) return res.status(500).json({ error: 'Error al actualizar la tienda.' });
  return res.status(200).json(mapStore(data));
}

async function storeProfileHandler(req, res) {
  if (req.method === 'GET')   return storeProfileGetHandler(req, res);        // público
  if (req.method === 'PATCH') return requireAdmin(storeProfilePatchHandler)(req, res);
  return res.status(405).json({ error: 'Método no permitido.' });
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const path = Array.isArray(req.query.path) ? req.query.path : [];
  const [seg0, seg1] = path;

  if (seg0 === 'customers' && !seg1) return requireStaff(customersListHandler)(req, res);
  if (seg0 === 'customers' && seg1)  return requireStaff((r, s) => customerDetailHandler(r, s, seg1))(req, res);

  if (seg0 === 'expenses' && !seg1)  return requireAdmin(expensesListHandler)(req, res);
  if (seg0 === 'expenses' && seg1)   return requireAdmin((r, s) => expenseDeleteHandler(r, s, seg1))(req, res);

  // store-profile no pasa por requireAuth acá arriba porque el GET debe ser
  // público (la pantalla de login lo necesita antes de que exista sesión) —
  // storeProfileHandler decide caso por caso, igual que el archivo original.
  if (seg0 === 'store-profile' && !seg1) return storeProfileHandler(req, res);

  return res.status(404).json({ error: 'Ruta no encontrada.' });
}
