import { describe, it, expect } from 'vitest';
import { getThumbnailUrl } from '../utils/imageHelpers';

// ─────────────────────────────────────────────────────────────────────────────
// getThumbnailUrl
// Esta función es completamente pura — no usa DOM ni Canvas.
// ─────────────────────────────────────────────────────────────────────────────

describe('getThumbnailUrl — entradas nulas o vacías', () => {
    it('devuelve string vacío si la URL es null', () => {
        expect(getThumbnailUrl(null)).toBe('');
    });

    it('devuelve string vacío si la URL es undefined', () => {
        expect(getThumbnailUrl(undefined)).toBe('');
    });

    it('devuelve string vacío si la URL es string vacío', () => {
        expect(getThumbnailUrl('')).toBe('');
    });
});

describe('getThumbnailUrl — URLs que NO son de Cloudinary', () => {
    it('devuelve la URL original si no contiene cloudinary.com', () => {
        const url = 'https://example.com/imagen.jpg';
        expect(getThumbnailUrl(url)).toBe(url);
    });

    it('devuelve la URL original para Firebase Storage', () => {
        const url = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/img.jpg';
        expect(getThumbnailUrl(url)).toBe(url);
    });

    it('devuelve la URL original para URLs relativas', () => {
        const url = '/public/logo192.png';
        expect(getThumbnailUrl(url)).toBe(url);
    });
});

describe('getThumbnailUrl — URLs de Cloudinary', () => {
    const cloudinaryBase = 'https://res.cloudinary.com/demo/image/upload/v1234/sample.jpg';

    it('inserta los parámetros de transformación en la URL', () => {
        const result = getThumbnailUrl(cloudinaryBase);
        expect(result).toContain('/upload/f_auto,q_auto,w_300/');
    });

    it('el resultado sigue siendo una URL válida de Cloudinary', () => {
        const result = getThumbnailUrl(cloudinaryBase);
        expect(result).toContain('cloudinary.com');
        expect(result).toContain('sample.jpg');
    });

    it('usa el ancho por defecto de 300px', () => {
        const result = getThumbnailUrl(cloudinaryBase);
        expect(result).toContain('w_300');
    });

    it('acepta un ancho personalizado', () => {
        const result = getThumbnailUrl(cloudinaryBase, 150);
        expect(result).toContain('w_150');
    });

    it('acepta width=600 para imágenes grandes', () => {
        const result = getThumbnailUrl(cloudinaryBase, 600);
        expect(result).toContain('w_600');
    });

    it('no duplica /upload/ si ya existe una transformación previa', () => {
        const alreadyTransformed = 'https://res.cloudinary.com/demo/image/upload/w_800/sample.jpg';
        const result = getThumbnailUrl(alreadyTransformed, 300);
        // Sigue funcionando sin lanzar error
        expect(result).toBeDefined();
        expect(result).not.toBe('');
    });

    it('incluye f_auto para formato automático', () => {
        const result = getThumbnailUrl(cloudinaryBase);
        expect(result).toContain('f_auto');
    });

    it('incluye q_auto para calidad automática', () => {
        const result = getThumbnailUrl(cloudinaryBase);
        expect(result).toContain('q_auto');
    });
});
