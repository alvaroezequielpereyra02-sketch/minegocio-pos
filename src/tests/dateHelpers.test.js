import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    firestoreToDate,
    formatRelativeDate,
    formatExportDate,
    formatDateKey,
    formatTimeOnly,
} from '../utils/dateHelpers';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de fixtures
// ─────────────────────────────────────────────────────────────────────────────

const ts = (date) => ({ seconds: Math.floor(date.getTime() / 1000) });

// Fecha "ahora mismo" con un offset en segundos
const secsAgo  = (s) => ts(new Date(Date.now() - s * 1000));
const minsAgo  = (m) => secsAgo(m * 60);
const daysAgo  = (d) => secsAgo(d * 86400);

// ─────────────────────────────────────────────────────────────────────────────
// firestoreToDate
// ─────────────────────────────────────────────────────────────────────────────

describe('firestoreToDate', () => {
    it('convierte un timestamp válido a Date', () => {
        const date = new Date('2025-01-15T12:00:00Z');
        const result = firestoreToDate(ts(date));
        expect(result).toBeInstanceOf(Date);
        expect(result.getFullYear()).toBe(2025);
    });

    it('devuelve null si el input es null', () => {
        expect(firestoreToDate(null)).toBeNull();
    });

    it('devuelve null si el input es undefined', () => {
        expect(firestoreToDate(undefined)).toBeNull();
    });

    it('devuelve null si seconds no es un número (serverTimestamp pendiente)', () => {
        expect(firestoreToDate({ seconds: null })).toBeNull();
        expect(firestoreToDate({ seconds: undefined })).toBeNull();
        expect(firestoreToDate({})).toBeNull();
    });

    it('devuelve null si seconds es NaN', () => {
        expect(firestoreToDate({ seconds: NaN })).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// formatRelativeDate
// ─────────────────────────────────────────────────────────────────────────────

describe('formatRelativeDate', () => {
    it('devuelve "Ahora mismo" cuando el timestamp es null (serverTimestamp pendiente)', () => {
        expect(formatRelativeDate(null)).toBe('Ahora mismo');
    });

    it('devuelve "Ahora mismo" cuando el timestamp es undefined', () => {
        expect(formatRelativeDate(undefined)).toBe('Ahora mismo');
    });

    it('devuelve "Hace un momento" para menos de 60 segundos', () => {
        expect(formatRelativeDate(secsAgo(30))).toBe('Hace un momento');
    });

    it('devuelve minutos para menos de 60 minutos', () => {
        const result = formatRelativeDate(minsAgo(14));
        expect(result).toBe('Hace 14 min');
    });

    it('devuelve "Hoy HH:MM" para la misma fecha de hoy', () => {
        // Anclamos el reloj a mediodía para que "90 minutos atrás" siempre sea hoy,
        // independientemente de la hora en que corra el test (evita fallos tras medianoche).
        const noon = new Date();
        noon.setHours(12, 0, 0, 0);
        vi.useFakeTimers();
        vi.setSystemTime(noon);
        try {
            const result = formatRelativeDate(minsAgo(90)); // 10:30 → sigue siendo hoy
            expect(result).toMatch(/^Hoy \d{2}:\d{2}$/);
        } finally {
            vi.useRealTimers();
        }
    });

    it('devuelve "Ayer HH:MM" para ayer', () => {
        const result = formatRelativeDate(daysAgo(1));
        expect(result).toMatch(/^Ayer \d{2}:\d{2}$/);
    });

    it('devuelve día de semana para menos de 7 días', () => {
        const result = formatRelativeDate(daysAgo(3));
        expect(result).toMatch(/^(Dom|Lun|Mar|Mié|Jue|Vie|Sáb) \d{2}:\d{2}$/);
    });

    it('devuelve DD/MM HH:MM para fechas de hace más de 7 días', () => {
        const result = formatRelativeDate(daysAgo(10));
        expect(result).toMatch(/^\d{2}\/\d{2} \d{2}:\d{2}$/);
    });

    it('nunca devuelve "Invalid Date"', () => {
        const cases = [null, undefined, {}, { seconds: NaN }, { seconds: null }];
        cases.forEach(input => {
            expect(formatRelativeDate(input)).not.toContain('Invalid');
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// formatExportDate
// ─────────────────────────────────────────────────────────────────────────────

describe('formatExportDate', () => {
    it('devuelve "Pendiente" cuando el timestamp es null', () => {
        expect(formatExportDate(null)).toBe('Pendiente');
    });

    it('devuelve "Pendiente" cuando el timestamp es undefined', () => {
        expect(formatExportDate(undefined)).toBe('Pendiente');
    });

    it('devuelve una fecha formateada para un timestamp válido', () => {
        const result = formatExportDate(ts(new Date('2025-03-15T14:30:00')));
        expect(result).toMatch(/15\/03\/2025/);
    });

    it('nunca devuelve "Invalid Date"', () => {
        expect(formatExportDate({ seconds: NaN })).toBe('Pendiente');
        expect(formatExportDate({})).toBe('Pendiente');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// formatDateKey
// ─────────────────────────────────────────────────────────────────────────────

describe('formatDateKey', () => {
    it('devuelve el fallback "—" cuando el timestamp es null', () => {
        expect(formatDateKey(null)).toBe('—');
    });

    it('acepta un fallback personalizado', () => {
        expect(formatDateKey(null, 'Sin fecha')).toBe('Sin fecha');
    });

    it('devuelve una cadena de fecha válida para un timestamp real', () => {
        const result = formatDateKey(ts(new Date('2025-03-15')));
        expect(typeof result).toBe('string');
        expect(result).not.toBe('—');
        expect(result).not.toContain('Invalid');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// formatTimeOnly
// ─────────────────────────────────────────────────────────────────────────────

describe('formatTimeOnly', () => {
    it('devuelve "" cuando el timestamp es null', () => {
        expect(formatTimeOnly(null)).toBe('');
    });

    it('devuelve la hora en formato HH:MM para un timestamp válido', () => {
        const fixed = new Date('2025-03-15T14:30:00');
        const result = formatTimeOnly(ts(fixed));
        expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    it('nunca devuelve "Invalid Date"', () => {
        expect(formatTimeOnly({ seconds: NaN })).toBe('');
        expect(formatTimeOnly({})).toBe('');
    });
});
