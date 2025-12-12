// src/utils/uploadImage.js

// TUS DATOS DE CLOUDINARY
const CLOUD_NAME = 'dlxbtzftv'; // <--- Tu Cloud Name (Ya puesto)
const UPLOAD_PRESET = 'minegocio_preset'; // <--- ¡BORRA ESTO Y PEGA EL NOMBRE DEL PASO 1!

export const uploadProductImage = async (base64Image, productName) => {
    // 1. Si no hay imagen o ya es una URL de internet, no hacemos nada
    if (!base64Image || base64Image.startsWith('http')) return base64Image;

    try {
        // 2. Preparamos los datos para enviar
        const formData = new FormData();
        formData.append('file', base64Image);
        formData.append('upload_preset', UPLOAD_PRESET);

        // Opcional: Limpiamos el nombre para que el archivo quede ordenado en Cloudinary
        const cleanName = productName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        formData.append('public_id', `productos/${cleanName}_${Date.now()}`);

        // 3. Enviamos la imagen a Cloudinary (POST)
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Error al subir imagen');
        }

        const data = await response.json();

        // 4. Devolvemos la URL segura (https)
        return data.secure_url;

    } catch (error) {
        console.error("❌ Error subiendo a Cloudinary:", error);
        alert("No se pudo subir la imagen. Verifica tu conexión.");
        return null; // Si falla, devolvemos null para que al menos se guarde el producto sin foto
    }
};