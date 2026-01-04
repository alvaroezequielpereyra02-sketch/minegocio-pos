// src/config/uploadImage.js

// Leemos las variables de entorno
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_PRESET;

// --- 1. FUNCIÓN DE SUBIDA ---
// CAMBIO IMPORTANTE: Renombramos de 'uploadProductImage' a 'uploadImage' 
// para que coincida con lo que esperan Modals.jsx y App.jsx
export const uploadImage = async (base64Image, productName = 'producto') => {
    if (!base64Image || base64Image.startsWith('http')) return base64Image;

    try {
        const formData = new FormData();
        formData.append('file', base64Image);
        formData.append('upload_preset', UPLOAD_PRESET);

        // Limpieza básica del nombre para el public_id
        const cleanName = productName ? productName.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'img';
        formData.append('public_id', `productos/${cleanName}_${Date.now()}`);

        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Error al subir imagen');
        }

        const data = await response.json();
        return data.secure_url;

    } catch (error) {
        console.error("❌ Error subiendo a Cloudinary:", error);
        alert("No se pudo subir la imagen.");
        return null;
    }
};

// --- 2. FUNCIÓN DE MINIATURAS ---
export const getThumbnailUrl = (url, width = 300) => {
    if (!url) return '';
    if (!url.includes('cloudinary.com')) return url;

    // Insertamos la transformación de calidad y tamaño
    return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`);
};