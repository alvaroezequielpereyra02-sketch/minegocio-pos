/**
 * api/_supabase.js
 *
 * Cliente de Supabase para las API Routes de Vercel.
 * Este archivo corre SOLO en el servidor — nunca en el cliente.
 *
 * Usamos la SERVICE_KEY (no la anon key) porque:
 * - Las API Routes son server-side: la clave nunca llega al navegador.
 * - Necesitamos bypasear RLS para operaciones administrativas.
 * - La validación de permisos ocurre en _middleware.js con el JWT propio.
 *
 * IMPORTANTE: Nunca importes este archivo desde src/ (código del cliente).
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl        = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    '[Supabase] Las variables SUPABASE_URL y SUPABASE_SERVICE_KEY son obligatorias. ' +
    'Verificá que estén definidas en Vercel → Settings → Environment Variables.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,  // No sesiones en el servidor
    autoRefreshToken: false,
  },
});
