/**
 * GET  /api/products   → lista de productos.
 *   - admin/employee: ven todo (incluso inactivos, si ?includeInactive=1).
 *   - sin autenticación (catálogo público, Fase 2B): solo activos + públicos.
 * POST /api/products   → crear producto (admin).
 */
import { supabase }      from '../../lib/supabase.js';
import { requireAdmin }  from '../../lib/middleware.js';
import { mapProduct }    from '../../lib/mappers.js';
import jwt                from 'jsonwebtoken';

const STORE_ID = process.env.SUPABASE_STORE_ID;

// Intenta leer el usuario del token si vino, pero no lo exige — este
// endpoint sirve tanto al panel de administración como, más adelante,
// al catálogo público sin login.
function tryGetUser(req) {
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

async function listHandler(req, res) {
  const user = tryGetUser(req);
  const isStaff = user && ['admin', 'employee'].includes(user.role);

  let q = supabase.from('products').select('*').eq('store_id', STORE_ID);

  if (isStaff) {
    if (req.query.includeInactive !== '1') q = q.eq('is_active', true);
  } else {
    // Visitante o cliente: solo lo que es públicamente visible.
    q = q.eq('is_active', true).eq('is_public', true);
  }

  if (req.query.category)    q = q.eq('category_id', req.query.category);
  if (req.query.subcategory) q = q.eq('subcategory_id', req.query.subcategory);
  if (req.query.search)      q = q.ilike('name', `%${req.query.search}%`);

  const { data, error } = await q.order('name').limit(1000);
  if (error) return res.status(500).json({ error: 'Error al listar productos.' });

  return res.status(200).json(data.map(mapProduct));
}

async function createHandler(req, res) {
  const body = req.body || {};
  if (!body.name || typeof body.name !== 'string') {
    return res.status(400).json({ error: 'El nombre del producto es obligatorio.' });
  }

  const { data, error } = await supabase
    .from('products')
    .insert({
      store_id:        STORE_ID,
      name:             body.name,
      description:      body.description || null,
      barcode:          body.barcode || null,
      category_id:      body.categoryId || null,
      subcategory_id:   body.subcategoryId || null,
      price:            body.price || 0,
      wholesale_price:  body.wholesalePrice ?? null,
      cost:             body.cost || 0,
      stock:            body.stock || 0,
      min_stock:        body.minStock || 0,
      unit:             body.unit || 'unidad',
      // Acepta tanto `images` (array, para cuando exista la UI de galería)
      // como `imageUrl` (string, el campo que usa el formulario actual).
      images:           body.images || (body.imageUrl ? [body.imageUrl] : []),
      is_public:        body.isPublic ?? true,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: 'Error al crear el producto.' });
  return res.status(201).json(mapProduct(data));
}

export default async function handler(req, res) {
  if (req.method === 'GET')  return listHandler(req, res);
  if (req.method === 'POST') return requireAdmin(createHandler)(req, res);
  return res.status(405).json({ error: 'Método no permitido.' });
}
