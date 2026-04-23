/**
 * sanitize.js — Utilidades de seguridad compartidas (cliente)
 *
 * Cubre dos vectores de ataque presentes en esta app:
 *
 * 1. XSS vía innerHTML (useExports.js, TransactionDetail.jsx)
 *    Los datos de Firestore (nombres de productos, tienda, notas de pago)
 *    se interpolan en templates HTML. Si un nombre contiene <script> o
 *    <img onerror=...>, se ejecuta en el contexto del documento al generar
 *    el PDF/ticket. escHtml() escapa los 5 caracteres peligrosos.
 *
 * 2. CSV Formula Injection (useExports.js)
 *    Campos que comienzan con =, +, -, @, TAB, CR abren una fórmula en Excel
 *    cuando el usuario importa el CSV. escCsv() los neutraliza anteponiendo
 *    un apóstrofo que Excel interpreta como texto literal.
 *
 * Nota: SQL/NoSQL injection no aplica aquí porque:
 *   - Firestore SDK usa queries parametrizadas internamente (nunca concatena strings).
 *   - Los únicos campos de Firestore con input de usuario son nombres y notas,
 *     que se guardan como strings y se muestran vía React (escaping automático
 *     en JSX). El único riesgo es cuando se usan en innerHTML — de ahí escHtml.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. Escape HTML — para interpolaciones en templates de innerHTML
// ─────────────────────────────────────────────────────────────────────────────

const HTML_ESCAPE_MAP = {
    '&':  '&amp;',
    '<':  '&lt;',
    '>':  '&gt;',
    '"':  '&quot;',
    "'":  '&#39;',
    // Backtick puede escapar contextos JS inline en algunos parsers
    '`':  '&#96;',
};

/**
 * escHtml(value) → string
 *
 * Escapa los caracteres peligrosos de una cadena para su uso seguro en innerHTML.
 * Convierte null/undefined a string vacío.
 *
 * @example
 * escHtml('<script>alert(1)</script>')  // → '&lt;script&gt;alert(1)&lt;/script&gt;'
 * escHtml('Tienda "Pepe" & Hnos.')      // → 'Tienda &quot;Pepe&quot; &amp; Hnos.'
 */
export const escHtml = (value) => {
    if (value == null) return '';
    return String(value).replace(/[&<>"'`]/g, (ch) => HTML_ESCAPE_MAP[ch]);
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. Escape CSV — contra Formula Injection en Excel/Sheets
// ─────────────────────────────────────────────────────────────────────────────

// Prefijos que Excel/Sheets interpretan como inicio de fórmula
const FORMULA_PREFIXES = /^[=+\-@\t\r]/;

/**
 * escCsv(value) → string
 *
 * Neutraliza fórmulas en campos CSV anteponiendo un apóstrofo.
 * Excel interpreta el apóstrofo como "tratar como texto", no lo muestra.
 * También escapa las comillas dobles internas para el formato RFC 4180.
 *
 * @example
 * escCsv('=SUM(A1:A10)')  // → "'=SUM(A1:A10)"
 * escCsv('Coca "Cola"')   // → 'Coca ""Cola""'   (para wrappear en "...")
 * escCsv(null)            // → ''
 */
export const escCsv = (value) => {
    if (value == null) return '';
    const str = String(value);
    // Neutralizar fórmulas
    if (FORMULA_PREFIXES.test(str)) return `'${str}`;
    return str;
};

/**
 * csvCell(value) → string
 *
 * Combina escCsv + wrapping en comillas dobles + escape interno de comillas.
 * Listo para insertar directamente en una línea CSV.
 *
 * @example
 * csvCell('Producto "A"')  // → '"Producto ""A"""'
 * csvCell('=HACK')         // → '"\'=HACK"'
 */
export const csvCell = (value) => {
    const escaped = escCsv(value);
    // Escapar comillas dobles internas (RFC 4180: "" → """")
    return `"${escaped.replace(/"/g, '""')}"`;
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. Validador de inputs de formulario (cliente)
// ─────────────────────────────────────────────────────────────────────────────

const RULES = {
    name:        { maxLen: 120, pattern: null },
    barcode:     { maxLen: 50,  pattern: /^[a-zA-Z0-9\-_.]*$/ },
    price:       { maxLen: 12,  pattern: /^\d+(\.\d{1,2})?$/ },
    cost:        { maxLen: 12,  pattern: /^\d+(\.\d{1,2})?$/ },
    stock:       { maxLen: 10,  pattern: /^-?\d+$/ },
    email:       { maxLen: 254, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    phone:       { maxLen: 20,  pattern: /^[\d\s\+\-().]*$/ },
    description: { maxLen: 500, pattern: null },
    note:        { maxLen: 300, pattern: null },
};

/**
 * validateField(fieldName, value) → { ok: boolean, error?: string }
 *
 * Valida un campo individual según reglas predefinidas.
 * Retorna { ok: true } si es válido, o { ok: false, error: '...' } si no.
 */
export const validateField = (fieldName, value) => {
    const rule = RULES[fieldName];
    if (!rule) return { ok: true }; // campo no conocido, permitir

    const str = String(value ?? '');

    if (str.length > rule.maxLen) {
        return { ok: false, error: `${fieldName} no puede superar ${rule.maxLen} caracteres` };
    }

    if (rule.pattern && str.length > 0 && !rule.pattern.test(str)) {
        return { ok: false, error: `${fieldName} contiene caracteres no permitidos` };
    }

    return { ok: true };
};
