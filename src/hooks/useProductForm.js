import { useState, useCallback } from 'react';
import { uploadImage }    from '../config/uploadImage';
import { compressImage }  from '../utils/imageHelpers';

/**
 * useProductForm
 * Maneja exclusivamente el formulario de producto:
 * imagen (archivo o URL), guardado y eliminación.
 *
 * La lógica de escaneo de barcodes fue movida a useInventoryScanner.
 */
export const useProductForm = ({
    editingProduct,
    addProduct,
    updateProduct,
    toggleModal,
    showNotification,
    setIsProcessing,
    setEditingProduct,
}) => {
    const [imageMode,    setImageMode]    = useState('link');
    const [previewImage, setPreviewImage] = useState('');

    // ── Guardar producto (crear o editar) ─────────────────────────────────────
    const handleSaveProductWrapper = useCallback(async (e) => {
        e.preventDefault();
        const f = e.target;
        const rawImage = imageMode === 'file'
            ? previewImage
            : (f.imageUrlLink?.value || '');

        setIsProcessing(true);
        try {
            const finalImageUrl = await uploadImage(rawImage, f.name.value);
            const wholesalePrice  = parseFloat(f.wholesalePrice?.value || 0);
            const wholesaleMinQty = parseInt(f.wholesaleMinQty?.value  || 0);

            const data = {
                name:            f.name.value,
                barcode:         f.barcode.value,
                price:           parseFloat(f.price.value),
                cost:            parseFloat(f.cost.value || 0),
                stock:           parseInt(f.stock.value),
                categoryId:      f.category.value,
                subCategoryId:   f.subcategory.value,
                imageUrl:        finalImageUrl || '',
                wholesalePrice:  wholesalePrice  || 0,
                wholesaleMinQty: wholesaleMinQty || 0,
            };

            if (editingProduct?.id) await updateProduct(editingProduct.id, data);
            else                    await addProduct(data);

            toggleModal('product', false);
            showNotification('✅ Producto guardado');
        } catch (err) {
            showNotification('❌ Error: ' + err.message);
        } finally {
            setIsProcessing(false);
        }
    }, [editingProduct, imageMode, previewImage, addProduct, updateProduct, toggleModal, showNotification, setIsProcessing]);

    // ── Cambio de archivo de imagen ───────────────────────────────────────────
    const handleFileChange = useCallback(async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            showNotification('⚠️ Imagen muy pesada (Máx 5MB)');
            return;
        }
        setIsProcessing(true);
        const base64 = await compressImage(file);
        setPreviewImage(base64);
        setIsProcessing(false);
    }, [showNotification, setIsProcessing]);

    return {
        imageMode,    setImageMode,
        previewImage, setPreviewImage,
        handleSaveProductWrapper,
        handleFileChange,
    };
};
