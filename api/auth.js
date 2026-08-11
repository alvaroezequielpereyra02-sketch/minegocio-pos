/**
 * api/auth.js
 *
 * Reemplaza a api/auth/[...path].js — ese patrón de "capturar todo" no se
 * estaba reconociendo como ruta real en este proyecto (Vercel + framework
 * "vite"), así que los pedidos caían en el catch-all de la SPA en vez de
 * llegar a nuestro código. La solución: un archivo concreto, sin
 * corchetes, que despacha internamente según `?action=`. Los archivos
 * concretos son el tipo de función más básico y confiable de la
 * plataforma — no dependen de ninguna convención de rutas dinámicas.
 *
 * La lógica interna de cada handler es idéntica a como estaba en la
 * versión anterior — esto es solo un cambio en cómo se despacha.
 *
 * URLs:
 *   POST  /api/auth?action=google
 *   POST  /api/auth?action=invite
 *   GET   /api/auth?action=invites       (admin)
 *   POST  /api/auth?action=invites       (admin)
 *   GET   /api/auth?action=me
 *   PATCH /api/auth?action=me-profile
 *   POST  /api/auth?action=refresh
 */
import { supabase }          from '../lib/supabase.js';
import { verifyGoogleToken } from '../lib/google.js';
import { requireAuth, requireAdmin, signToken } from '../lib/middleware.js';
import { mapUser, mapInvitationCode }            from '../lib/mappers.js';

const STORE_ID = process.env.SUPABASE_STORE_ID;

// ── action=google ────────────────────────────────────────────────────────────

async function googleHandler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });

  try {
    const { idToken } = req.body || {};
    const google = await verifyGoogleToken(idToken);

    const { data: existing, error: findErr } = await supabase
      .from('users').select('*')
      .eq('store_id', STORE_ID).eq('google_id', google.googleId)
      .maybeSingle();
    if (findErr) throw findErr;

    let userRow = existing;

    if (!userRow) {
      const { data: byEmail, error: emailErr } = await supabase
        .from('users').select('*')
        .eq('store_id', STORE_ID).eq('email', google.email)
        .maybeSingle();
      if (emailErr) throw emailErr;

      if (byEmail) {
        const { data: linked, error: linkErr } = await supabase
          .from('users')
          .update({ google_id: google.googleId, avatar_url: google.avatarUrl })
          .eq('id', byEmail.id).select().single();
        if (linkErr) throw linkErr;
        userRow = linked;
      } else {
        const { data: created, error: createErr } = await supabase
          .from('users')
          .insert({
            store_id: STORE_ID, email: google.email, name: google.name,
            google_id: google.googleId, avatar_url: google.avatarUrl,
            role: 'client', profile_complete: false,
          })
          .select().single();
        if (createErr) throw createErr;
        userRow = created;
      }
    }

    if (userRow.is_active === false) {
      return res.status(403).json({ error: 'Esta cuenta fue desactivada. Contactate con el negocio.' });
    }

    const token = signToken({
      id: userRow.id, role: userRow.role, store_id: STORE_ID,
      email: userRow.email, name: userRow.name,
    });

    return res.status(200).json({ user: mapUser(userRow), token });

  } catch (e) {
    console.error('[auth?action=google] Error:', e.message);
    return res.status(e.status || 500).json({ error: e.status ? e.message : 'Error interno del servidor.' });
  }
}

// ── action=invite ────────────────────────────────────────────────────────────

async function inviteHandler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });

  try {
    const { idToken, inviteCode } = req.body || {};
    if (!inviteCode || typeof inviteCode !== 'string') {
      return res.status(400).json({ error: 'Código de invitación requerido.' });
    }

    const google = await verifyGoogleToken(idToken);
    const cleanCode = inviteCode.trim().toUpperCase();

    const { data: invite, error: inviteErr } = await supabase
      .from('invitation_codes').select('*')
      .eq('store_id', STORE_ID).eq('code', cleanCode).is('used_by', null)
      .maybeSingle();
    if (inviteErr) throw inviteErr;
    if (!invite) return res.status(400).json({ error: 'Código de invitación inválido o ya utilizado.' });
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Este código de invitación expiró.' });
    }

    const { data: existing, error: findErr } = await supabase
      .from('users').select('*')
      .eq('store_id', STORE_ID).eq('google_id', google.googleId)
      .maybeSingle();
    if (findErr) throw findErr;

    let userRow;
    if (existing) {
      const { data: updated, error: updateErr } = await supabase
        .from('users')
        .update({ role: invite.role, profile_complete: true, avatar_url: google.avatarUrl })
        .eq('id', existing.id).select().single();
      if (updateErr) throw updateErr;
      userRow = updated;
    } else {
      const { data: created, error: createErr } = await supabase
        .from('users')
        .insert({
          store_id: STORE_ID, email: google.email, name: google.name,
          google_id: google.googleId, avatar_url: google.avatarUrl,
          role: invite.role, profile_complete: true,
        })
        .select().single();
      if (createErr) throw createErr;
      userRow = created;
    }

    const { error: markErr } = await supabase
      .from('invitation_codes')
      .update({ used_by: userRow.id, used_at: new Date().toISOString() })
      .eq('id', invite.id);
    if (markErr) throw markErr;

    const token = signToken({
      id: userRow.id, role: userRow.role, store_id: STORE_ID,
      email: userRow.email, name: userRow.name,
    });

    return res.status(200).json({ user: mapUser(userRow), token });

  } catch (e) {
    console.error('[auth?action=invite] Error:', e.message);
    return res.status(e.status || 500).json({ error: e.status ? e.message : 'Error interno del servidor.' });
  }
}

// ── action=invites (admin) ──────────────────────────────────────────────────

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generateCode(length = 8) {
  let code = '';
  for (let i = 0; i < length; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

async function invitesHandler(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('invitation_codes').select('*')
      .eq('store_id', STORE_ID).order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: 'Error al listar códigos.' });
    return res.status(200).json(data.map(mapInvitationCode));
  }

  if (req.method === 'POST') {
    const { role = 'employee', expiresInDays } = req.body || {};
    if (!['admin', 'employee'].includes(role)) {
      return res.status(400).json({ error: "role debe ser 'admin' o 'employee'." });
    }

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    let data, insertError;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      const result = await supabase
        .from('invitation_codes')
        .insert({ store_id: STORE_ID, code, role, expires_at: expiresAt, created_by: req.user.sub })
        .select().single();
      if (!result.error) { data = result.data; insertError = null; break; }
      insertError = result.error;
      if (result.error.code !== '23505') break;
    }

    if (insertError) return res.status(500).json({ error: 'Error al generar el código.' });
    return res.status(201).json(mapInvitationCode(data));
  }

  return res.status(405).json({ error: 'Método no permitido.' });
}

// ── action=me ────────────────────────────────────────────────────────────────

async function meHandler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido.' });

  const { data, error } = await supabase
    .from('users').select('*').eq('id', req.user.sub).maybeSingle();

  if (error) return res.status(500).json({ error: 'Error al obtener el perfil.' });
  if (!data)  return res.status(404).json({ error: 'Usuario no encontrado.' });
  if (data.is_active === false) return res.status(403).json({ error: 'Esta cuenta fue desactivada.' });

  return res.status(200).json(mapUser(data));
}

// ── action=me-profile ────────────────────────────────────────────────────────

function clean(v, max = 200) {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

async function meProfileHandler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Método no permitido.' });

  const name         = clean(req.body?.name, 120);
  const businessName = clean(req.body?.businessName, 120);
  const address       = clean(req.body?.address, 300);
  const phone         = clean(req.body?.phone, 40);

  if (!name || !address || !phone) {
    return res.status(400).json({ error: 'Nombre, dirección y teléfono son obligatorios.' });
  }

  const { data, error } = await supabase
    .from('users')
    .update({ name, business_name: businessName, address, phone, profile_complete: true })
    .eq('id', req.user.sub).select().single();

  if (error) return res.status(500).json({ error: 'Error al guardar el perfil.' });
  return res.status(200).json(mapUser(data));
}

// ── action=refresh ───────────────────────────────────────────────────────────

async function refreshHandler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });

  const { data, error } = await supabase
    .from('users').select('*').eq('id', req.user.sub).maybeSingle();

  if (error || !data) return res.status(401).json({ error: 'Usuario no encontrado.' });
  if (data.is_active === false) return res.status(403).json({ error: 'Esta cuenta fue desactivada.' });

  const token = signToken({
    id: data.id, role: data.role, store_id: data.store_id,
    email: data.email, name: data.name,
  });

  return res.status(200).json({ token });
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const action = req.query.action;

  if (action === 'google')      return googleHandler(req, res);
  if (action === 'invite')      return inviteHandler(req, res);
  if (action === 'invites')     return requireAdmin(invitesHandler)(req, res);
  if (action === 'me')          return requireAuth(meHandler)(req, res);
  if (action === 'me-profile')  return requireAuth(meProfileHandler)(req, res);
  if (action === 'refresh')     return requireAuth(refreshHandler)(req, res);

  return res.status(404).json({ error: 'Acción no reconocida. Usá ?action=google|invite|invites|me|me-profile|refresh.' });
}
