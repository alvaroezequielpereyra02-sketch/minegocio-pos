import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useInventoryScanner
 * Maneja el escaneo de barcodes en la vista Inventario.
 * Soporta tres fuentes de entrada:
 *
 *  1. Lectores HID (USB / Bluetooth que simulan teclado)
 *     → Detectados por velocidad de escritura: caracteres que llegan
 *       en ráfagas < SCANNER_CHAR_GAP_MS se tratan como escáner.
 *       La mayoría de estos lectores terminan con Enter automático.
 *
 *  2. Lectores HID que NO mandan Enter
 *     → Un timer de SCANNER_FLUSH_MS vacía el buffer automáticamente
 *       si la ráfaga termina sin Enter.
 *
 *  3. Input manual (el usuario tipea el código en el campo visible)
 *     → handleBarcodeSubmit se llama al hacer submit del form.
 *
 * El estado scannedProduct se maneja internamente, eliminando el bug
 * donde el modal de stock no aparecía porque scannedProduct era null.
 */

// ── Constantes de timing ──────────────────────────────────────────────────────
// Tiempo máximo entre caracteres para considerar que viene de un escáner.
// Los lectores físicos suelen enviar a < 20ms entre chars.
// El tipeo humano rápido ronda los 80-150ms entre teclas.
const SCANNER_CHAR_GAP_MS = 50;

// Si el buffer tiene contenido y no llega nada en este tiempo, se procesa.
// Cubre lectores que no mandan Enter.
const SCANNER_FLUSH_MS = 300;

// Largo mínimo de código para procesarlo (evita falsos positivos de 1-2 chars).
const MIN_BARCODE_LENGTH = 3;

export const useInventoryScanner = ({
    products,
    activeTab,
    toggleModal,
    showNotification,
    requestConfirm,
    setEditingProduct,
}) => {
    // Estado del producto encontrado — ahora vive acá, no en App.jsx
    const [scannedProduct, setScannedProduct] = useState(null);

    // Input del campo visible (para tipeo manual)
    const [barcodeInput, setBarcodeInput] = useState('');

    // true mientras se busca/procesa un código (feedback visual)
    const [isScanning, setIsScanning] = useState(false);

    // Ref para hacer foco en el input de cantidad del modal de stock
    const quantityInputRef = useRef(null);

    // Buffer interno para el listener global de HID
    const hidBuffer = useRef('');
    const lastCharTime = useRef(0);
    const flushTimer = useRef(null);

    // ── Lógica central: procesar un código de cualquier fuente ────────────────
    const processBarcode = useCallback((rawCode) => {
        const code = rawCode.trim();
        if (code.length < MIN_BARCODE_LENGTH) return;

        setIsScanning(true);
        setBarcodeInput('');

        const found = products.find(p => p.barcode === code);

        if (found) {
            setScannedProduct(found);
            toggleModal('stock', true);
            // Pequeño delay para que el modal monte antes de intentar el foco
            setTimeout(() => {
                quantityInputRef.current?.focus();
                setIsScanning(false);
            }, 150);
        } else {
            setIsScanning(false);
            showNotification(`⚠️ Código "${code}" no encontrado`);
            requestConfirm(
                'Producto no encontrado',
                `El código "${code}" no existe en el inventario.\n¿Querés crear un nuevo producto con este código?`,
                () => {
                    setEditingProduct({ barcode: code });
                    toggleModal('product', true);
                }
            );
        }
    }, [products, toggleModal, showNotification, requestConfirm, setEditingProduct]);

    // ── Listener global para lectores HID ────────────────────────────────────
    // Solo se registra cuando la tab activa es 'inventory'.
    // Al cambiar de tab, el cleanup del efecto anterior remueve el listener
    // y el nuevo ciclo retorna temprano sin añadir uno nuevo.
    useEffect(() => {
        if (activeTab !== 'inventory') return;
        const handleKeyDown = (e) => {
            const activeTag = document.activeElement?.tagName?.toUpperCase();
            const activeType = document.activeElement?.type?.toLowerCase();

            // Si el foco está en un textarea o en un input que NO sea el de barcode,
            // dejamos que el evento pase normal (el usuario está escribiendo otra cosa).
            const isForeignInput =
                activeTag === 'TEXTAREA' ||
                (activeTag === 'INPUT' && activeType !== 'text' && activeType !== 'search' && activeType !== '') ||
                activeTag === 'SELECT';

            if (isForeignInput) return;

            const now = Date.now();
            const gap = now - lastCharTime.current;
            lastCharTime.current = now;

            // Enter → vaciar buffer inmediatamente
            if (e.key === 'Enter') {
                clearTimeout(flushTimer.current);
                if (hidBuffer.current.length >= MIN_BARCODE_LENGTH) {
                    const code = hidBuffer.current;
                    hidBuffer.current = '';
                    processBarcode(code);
                } else {
                    hidBuffer.current = '';
                }
                return;
            }

            // Solo caracteres imprimibles de un carácter (ignora Shift, Ctrl, etc.)
            if (e.key.length !== 1) return;

            // Si la ráfaga es rápida (escáner) o el buffer ya tiene contenido
            // de una ráfaga previa → acumular en el buffer HID.
            const isRapidInput = gap < SCANNER_CHAR_GAP_MS;
            const bufferActive = hidBuffer.current.length > 0;

            if (isRapidInput || bufferActive) {
                // Prevenir que el carácter caiga en un input visible
                if (bufferActive) e.preventDefault();

                hidBuffer.current += e.key;

                // Reiniciar el timer de auto-flush (para lectores sin Enter)
                clearTimeout(flushTimer.current);
                flushTimer.current = setTimeout(() => {
                    if (hidBuffer.current.length >= MIN_BARCODE_LENGTH) {
                        const code = hidBuffer.current;
                        hidBuffer.current = '';
                        processBarcode(code);
                    } else {
                        hidBuffer.current = '';
                    }
                }, SCANNER_FLUSH_MS);
            }
            // Si no es rápido y el buffer está vacío → tipeo manual,
            // dejamos que caiga en el input visible normalmente.
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            clearTimeout(flushTimer.current);
        };
    }, [processBarcode, activeTab]);

    // ── Submit manual desde el campo visible ──────────────────────────────────
    const handleBarcodeSubmit = useCallback((e) => {
        e.preventDefault();
        if (!barcodeInput.trim()) return;
        processBarcode(barcodeInput);
    }, [barcodeInput, processBarcode]);

    // ── Limpiar producto escaneado (al cerrar el modal de stock) ──────────────
    const clearScannedProduct = useCallback(() => {
        setScannedProduct(null);
    }, []);

    return {
        // Estado
        scannedProduct,
        setScannedProduct,
        clearScannedProduct,
        isScanning,

        // Input manual
        barcodeInput,
        setBarcodeInput,
        handleBarcodeSubmit,

        // Ref para el modal de stock
        quantityInputRef,
    };
};
