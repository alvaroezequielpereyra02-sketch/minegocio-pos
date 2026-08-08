/**
 * GET    /api/products/:id  → un producto (staff, o público si es visible).
 * PATCH  /api/products/:id  → actualizar. Admin: cualquier campo.
 *                              Employee: SOLO el campo `stock` (igual que la
 *                              regla `onlyUpdatingStock()` que tenía Firestore).
 * DELETE /api/products/:id  → soft-delete (is_active=false), admin.
 */
import { supabase }     from '../_supabase.js';
import { requireStaff } from '../_middleware.js';
import { mapProduct }   from '../_mappers.js';

const STORE_ID = process.env.SUPABASE_STORE_ID;

// Campos que un employee puede tocar sin ser admin.
const EMPLOYEE_ALLOWED_FIELDS = ['stock'];

const FIELD_MAP = {
  name: 'name', description: 'description', barcode: 'barcode',
  categoryId: 'category_id', subcategoryId: 'subcategory_id',
  price: 'price', wholesalePrice: 'wholesale_price', cost: 'cost',
  stock: 'stock', minStock: 'min_stock', unit: 'unit',
  images: 'images', isActive: 'is_active', isPublic: 'is_public',
};

async function handler(req, res) {
  const { id } = req.query;

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
        return res.status(403).json({
          error: 'Como empleado, solo podés actualizar el stock de un producto.',
        });
      }
    }

    const update = {};
    for (const key of keys) {
      if (FIELD_MAP[key]) update[FIELD_MAP[key]] = body[key];
    }
    // `imageUrl` (string) es la comodidad que usa el formulario actual —
    // se traduce a `images` (array) que es como se guarda de verdad.
    if ('imageUrl' in body) {
      update.images = body.imageUrl ? [body.imageUrl] : [];
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'No se envió ningún campo válido para actualizar.' });
    }

    const { data, error } = await supabase
      .from('products').update(update)
      .eq('store_id', STORE_ID).eq('id', id)
      .select().single();

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

export default requireStaff(handler);
