/**
 * dateHelpers.js
 * Utilidades centralizadas para formateo de fechas en toda la aplicación.
 *
 * Resuelve el problema de "Invalid Date" causado por serverTimestamp() de
 * Firestore, que devuelve null en el primer snapshot antes de que el servidor
 * resuelva el valor real. Cualquier operación aritmética sobre null produce
 * NaN → new Date(NaN) → "Invalid Date".
 *
 * Todas las funciones de este módulo son seguras ante:
 *   - date === null / undefined
 *   - date.seconds === undefined  (serverTimestamp aún pendiente)
 *   - date.seconds === NaN
 */

// ── Días de la semana en español (abreviados) ─────────────────────────────────
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// ── Helpers internos ──────────────────────────────────────────────────────────

/**
 * Convierte un timestamp de Firestore ({ seconds, nanoseconds }) a Date.
 * Devuelve null si el timestamp todavía no fue resuelto por el servidor.
 *
 * @param {object|null|undefined} firestoreDate
 * @returns {Date|null}
 */
export function firestoreToDate(firestoreDate) {
    if (!firestoreDate || typeof firestoreDate.seconds !== 'number') return null;
    return new Date(firestoreDate.seconds * 1000);
}

/**
 * Formatea HH:MM a partir de un objeto Date.
 *
 * @param {Date} date
 * @returns {string}
 */
function formatTime(date) {
    return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Devuelve true si dos fechas son el mismo día calendario.
 *
 * @param {Date} a
 * @param {Date} b
 * @returns {boolean}
 */
function isSameDay(a, b) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth()    === b.getMonth()    &&
        a.getDate()     === b.getDate()
    );
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Formato relativo inteligente para mostrar en listas de la UI.
 * Pensado especialmente para el listado de gastos del Dashboard.
 *
 * Ejemplos de salida:
 *   "Ahora mismo"   → serverTimestamp aún pendiente
 *   "Hace un momento" → < 60 segundos
 *   "Hace 14 min"   → < 60 minutos
 *   "Hoy 14:30"     → mismo día
 *   "Ayer 09:15"    → día anterior
 *   "Lun 14:30"     → esta semana (< 7 días)
 *   "12/03 14:30"   → más viejo
 *
 * @param {object|null|undefined} firestoreDate  Timestamp de Firestore
 * @returns {string}
 */
export function formatRelativeDate(firestoreDate) {
    const date = firestoreToDate(firestoreDate);

    // serverTimestamp todavía no resuelto por el servidor
    if (!date) return 'Ahora mismo';

    const now   = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffMs / 60_000);

    // Menos de 60 segundos
    if (diffSec < 60)  return 'Hace un momento';

    // Menos de 60 minutos
    if (diffMin < 60)  return `Hace ${diffMin} min`;

    const time = formatTime(date);

    // Hoy
    if (isSameDay(date, now)) return `Hoy ${time}`;

    // Ayer
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (isSameDay(date, yesterday)) return `Ayer ${time}`;

    // Esta semana (< 7 días)
    if (diffMs < 7 * 24 * 60 * 60_000) {
        return `${DIAS[date.getDay()]} ${time}`;
    }

    // Más viejo → DD/MM HH:MM
    const day   = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month} ${time}`;
}

/**
 * Formato corto para exportaciones (CSV, PDF).
 * Siempre devuelve un string válido — nunca "Invalid Date".
 *
 * Ejemplos de salida:
 *   "Pendiente"           → serverTimestamp no resuelto
 *   "12/03/2025 14:30"   → fecha resuelta
 *
 * @param {object|null|undefined} firestoreDate  Timestamp de Firestore
 * @returns {string}
 */
export function formatExportDate(firestoreDate) {
    const date = firestoreToDate(firestoreDate);
    if (!date) return 'Pendiente';
    return date.toLocaleString('es-AR', {
        day:    '2-digit',
        month:  '2-digit',
        year:   'numeric',
        hour:   '2-digit',
        minute: '2-digit',
    });
}

/**
 * Formato largo para encabezados de sección (ej: agrupador del Historial).
 * Devuelve la fecha como "12/3/2025" o un fallback si no está resuelta.
 *
 * @param {object|null|undefined} firestoreDate  Timestamp de Firestore
 * @param {string} [fallback='—']
 * @returns {string}
 */
export function formatDateKey(firestoreDate, fallback = '—') {
    const date = firestoreToDate(firestoreDate);
    if (!date) return fallback;
    return date.toLocaleDateString('es-AR');
}

/**
 * Solo la hora HH:MM. Devuelve '' si no está resuelta (para no mostrar nada).
 *
 * @param {object|null|undefined} firestoreDate  Timestamp de Firestore
 * @returns {string}
 */
export function formatTimeOnly(firestoreDate) {
    const date = firestoreToDate(firestoreDate);
    if (!date) return '';
    return formatTime(date);
}
