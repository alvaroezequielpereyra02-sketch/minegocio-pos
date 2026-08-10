/**
 * lib/env.js
 *
 * Carga .env.local manualmente en desarrollo local.
 *
 * `vercel dev` no siempre sincroniza hacia el runtime de las funciones /api/
 * las variables que se agregan o editan a mano en .env.local — es un
 * comportamiento inconsistente conocido de la CLI. Para no depender de eso,
 * cada función carga el archivo directamente con la API nativa de Node.
 *
 * En producción real (Vercel), este archivo no existe y las variables ya
 * vienen inyectadas correctamente por la plataforma — por eso el try/catch
 * silencioso: si el archivo no está, no pasa nada, seguimos con process.env
 * tal cual lo puso Vercel.
 */
if (process.env.NODE_ENV !== 'production') {
  try {
    process.loadEnvFile('.env.local');
  } catch {
    // .env.local no existe (ej: en producción) — está bien, seguimos.
  }
}
