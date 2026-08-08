/**
 * api/_mappers.js
 *
 * Convierte filas de Supabase (snake_case, como están en PostgreSQL) a objetos
 * camelCase (como se usan en el frontend de React). Mantener esta conversión
 * centralizada evita que el snake_case de la base de datos se filtre al resto
 * del código — el frontend nunca debería enterarse de que la DB usa snake_case.
 */

export function mapUser(row) {
  if (!row) return null;
  return {
    id:              row.id,
    storeId:         row.store_id,
    email:           row.email,
    name:            row.name,
    phone:           row.phone,
    address:         row.address,
    businessName:    row.business_name,
    role:            row.role,
    avatarUrl:       row.avatar_url,
    commissionRate:  row.commission_rate,
    isActive:        row.is_active,
    profileComplete: row.profile_complete,
    createdAt:       row.created_at,
  };
}

export function mapInvitationCode(row) {
  if (!row) return null;
  return {
    id:        row.id,
    code:      row.code,
    role:      row.role,
    usedBy:    row.used_by,
    usedAt:    row.used_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

// =============================================================================
// Fase 2A
// =============================================================================

export function mapProduct(row) {
  if (!row) return null;
  return {
    id:             row.id,
    name:           row.name,
    description:    row.description,
    barcode:        row.barcode,
    categoryId:     row.category_id,
    subcategoryId:  row.subcategory_id,
    price:          Number(row.price),
    wholesalePrice: row.wholesale_price !== null ? Number(row.wholesale_price) : null,
    cost:           Number(row.cost),
    stock:          Number(row.stock),
    minStock:       Number(row.min_stock),
    unit:           row.unit,
    images:         row.images || [],
    // Compatibilidad con el formulario actual (una sola imagen, campo
    // `imageUrl`). `images[]` sigue siendo la fuente de verdad en la DB —
    // esto es solo una comodidad de lectura para no tocar Modals.jsx ahora.
    // El día que se construya la UI de galería (varias fotos), se pasa a
    // consumir `images` directamente y este campo se puede retirar.
    imageUrl:       (row.images && row.images[0]) || null,
    isActive:       row.is_active,
    isPublic:       row.is_public,
    createdAt:      row.created_at,
    updatedAt:      row.updated_at,
  };
}

export function mapCategory(row) {
  if (!row) return null;
  return { id: row.id, name: row.name, sortOrder: row.sort_order, createdAt: row.created_at };
}

export function mapSubcategory(row) {
  if (!row) return null;
  return {
    id:         row.id,
    categoryId: row.category_id,
    name:       row.name,
    sortOrder:  row.sort_order,
    createdAt:  row.created_at,
  };
}

export function mapCustomer(row) {
  if (!row) return null;
  return {
    id:          row.id,
    name:        row.name,
    phone:       row.phone,
    address:     row.address,
    email:       row.email,
    isWholesale: row.is_wholesale,
    notes:       row.notes,
    createdAt:   row.created_at,
  };
}

export function mapExpense(row) {
  if (!row) return null;
  return {
    id:          row.id,
    amount:      Number(row.amount),
    category:    row.category,
    description: row.description,
    date:        row.date,
    createdBy:   row.created_by,
    createdAt:   row.created_at,
  };
}

export function mapStore(row) {
  if (!row) return null;
  return {
    id:      row.id,
    slug:    row.slug,
    name:    row.name,
    logoUrl: row.logo_url,
    address: row.address,
    phone:   row.phone,
    email:   row.email,
    taxId:   row.tax_id,
    currency: row.currency,
    config:  row.config || {},
  };
}
