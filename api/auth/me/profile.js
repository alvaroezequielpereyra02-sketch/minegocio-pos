/**
 * PATCH /api/auth/me/profile
 *
 * Completa o actualiza el perfil obligatorio del cliente: nombre, nombre
 * del negocio, dirección y teléfono. Marca profile_complete=true — esto es
 * lo que destraba la posibilidad de confirmar un pedido.
 *
 * businessName es el único campo opcional (no todos los clientes son
 * revendedores con negocio propio); el resto es obligatorio.
 */
import { supabase }    from '../../_supabase.js';
import { requireAuth } from '../../_middleware.js';
import { mapUser }     from '../../_mappers.js';

function clean(v, max = 200) {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

async function handler(req, res) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const name         = clean(req.body?.name, 120);
  const businessName = clean(req.body?.businessName, 120);
  const address       = clean(req.body?.address, 300);
  const phone         = clean(req.body?.phone, 40);

  if (!name || !address || !phone) {
    return res.status(400).json({
      error: 'Nombre, dirección y teléfono son obligatorios.',
    });
  }

  const { data, error } = await supabase
    .from('users')
    .update({
      name,
      business_name: businessName,
      address,
      phone,
      profile_complete: true,
    })
    .eq('id', req.user.sub)
    .select()
    .single();

  if (error) return res.status(500).json({ error: 'Error al guardar el perfil.' });

  return res.status(200).json(mapUser(data));
}

export default requireAuth(handler);
