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
