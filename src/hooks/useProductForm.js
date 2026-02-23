import { useState, useRef } from 'react';
import { uploadImage }    from '../config/uploadImage';
import { compressImage }  from '../utils/imageHelpers';

/**
 * useProductForm
 * Maneja el formulario de producto: imagen, barcode de inventario,
 * guardado y eliminación. Extrae toda esa lógica de App.jsx.
 */
export const useProductForm = ({
    products,
    editingProduct,
    addProduct,
    updateProduct,
    addStock,
    toggleModal,
    showNotification,
    requestConfirm,
    setIsProcessing,
    setEditingProduct,
}) => {
    const [imageMode,    setImageMode]    = useState('link');
    const [previewImage, setPreviewImage] = useState('');
    const [inventoryBarcodeInput, setInventoryBarcodeInput] = useState('');

    const quantityInputRef = useRef(null);

    // ── Guardar producto (crear o editar) ─────────────────────────────────────
    const handleSaveProductWrapper = async (e) => {
        e.preventDefault();
        const f = e.target;
        const rawImage = imageMode === 'file'
            ? previewImage
            : (f.imageUrlLink?.value || '');

        setIsProcessing(true);
        try {
            const finalImageUrl = await uploadImage(rawImage, f.name.value);
            const data = {
                name:          f.name.value,
                barcode:       f.barcode.value,
                price:         parseFloat(f.price.value),
                cost:          parseFloat(f.cost.value || 0),
                stock:         parseInt(f.stock.value),
                categoryId:    f.category.value,
                subCategoryId: f.subcategory.value,
                imageUrl:      finalImageUrl || '',
            };
            if (editingProduct?.id) await updateProduct(editingProduct.id, data);
            else                    await addProduct(data);
            toggleModal('product', false);
            showNotification("✅ Producto guardado");
        } catch (err) {
            showNotification("❌ Error: " + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    // ── Cambio de archivo de imagen ───────────────────────────────────────────
    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            showNotification("⚠️ Imagen muy pesada (Máx 5MB)");
            return;
        }
        setIsProcessing(true);
        const base64 = await compressImage(file);
        setPreviewImage(base64);
        setIsProcessing(false);
    };

    // ── Escáner de barcode en la vista Inventario ─────────────────────────────
    const handleInventoryBarcodeSubmit = (e) => {
        e.preventDefault();
        if (!inventoryBarcodeInput) return;

        const found = products.find(p => p.barcode === inventoryBarcodeInput);
        if (found) {
            // Producto existe → abrir modal de stock
            toggleModal('stock', true);
            setTimeout(() => quantityInputRef.current?.focus(), 100);
        } else {
            // Producto no existe → ofrecer crear uno nuevo
            requestConfirm("Producto no existe", "¿Crear nuevo?", () => {
                setEditingProduct({ barcode: inventoryBarcodeInput });
                toggleModal('product', true);
            });
        }
        setInventoryBarcodeInput('');
    };

    return {
        imageMode,          setImageMode,
        previewImage,       setPreviewImage,
        inventoryBarcodeInput, setInventoryBarcodeInput,
        quantityInputRef,
        handleSaveProductWrapper,
        handleFileChange,
        handleInventoryBarcodeSubmit,
    };
};
