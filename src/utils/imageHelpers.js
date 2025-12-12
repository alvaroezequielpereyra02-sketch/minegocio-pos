// Función para pedirle a Cloudinary una versión optimizada y pequeña
export const getThumbnailUrl = (url, width = 300) => {
    if (!url) return '';
    if (!url.includes('cloudinary.com')) return url; // Si no es de Cloudinary, devolver original

    // Insertamos los parámetros de transformación en la URL
    // f_auto: Mejor formato (WebP/AVIF) automático según el navegador
    // q_auto: Calidad automática (reduce peso sin perder nitidez visible)
    // w_300: Ancho de 300px (suficiente para la grilla)
    return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`);
};