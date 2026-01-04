// src/utils/imageHelpers.js

/**
 * Comprime una imagen antes de subirla para ahorrar ancho de banda y espacio.
 * @param {File} file - El archivo de imagen original.
 * @returns {Promise<string>} - Una promesa que resuelve con la imagen en formato Base64 comprimida.
 */
export const compressImage = (file) => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800; // Ancho máximo optimizado para la web
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Retornamos la imagen en formato JPEG con calidad del 70%
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    });
};

/**
 * Genera una URL de miniatura optimizada de Cloudinary.
 */
export const getThumbnailUrl = (url, width = 300) => {
    if (!url) return '';
    if (!url.includes('cloudinary.com')) return url;
    return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`);
};