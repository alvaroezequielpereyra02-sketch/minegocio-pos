import { useState } from 'react';

// COMANDOS ESC/POS
const ESC = '\x1B';
const GS = '\x1D';
const INIT = ESC + '@';
const CUT = GS + 'V' + '\x41' + '\x00';
const BOLD_ON = ESC + 'E' + '\x01';
const BOLD_OFF = ESC + 'E' + '\x00';
const ALIGN_CENTER = ESC + 'a' + '\x01';
const ALIGN_LEFT = ESC + 'a' + '\x00';
const ALIGN_RIGHT = ESC + 'a' + '\x02';

export const usePrinter = (onNotify = () => {}) => {
    const [isPrinting, setIsPrinting] = useState(false);
    const [printerDevice, setPrinterDevice] = useState(null);

    // --- 1. CONEXIÓN WEB BLUETOOTH ---
    const connectBluetooth = async () => {
        // Guard: Web Bluetooth no está soportado (iOS Safari, Firefox, Edge legacy, etc.)
        // En estos browsers navigator.bluetooth directamente no existe.
        if (!('bluetooth' in navigator)) {
            onNotify('❌ Tu navegador no soporta Bluetooth. Usá Chrome en Android.');
            return;
        }

        try {
            // ──────────────────────────────────────────────────────────────────
            // Comportamiento en Android Chrome cuando el Bluetooth está APAGADO:
            //
            //   requestDevice() dispara automáticamente el diálogo nativo del
            //   sistema "¿Activar Bluetooth?" SIN necesitar código extra.
            //
            //   • Usuario acepta  → BT se enciende, aparece el selector de impresoras
            //   • Usuario rechaza → lanza NotFoundError (mismo error que cancelar el picker)
            //
            // Por eso NO hace falta un step previo de "verificar si BT está on":
            // el browser ya lo maneja mostrando el diálogo nativo.
            // ──────────────────────────────────────────────────────────────────
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
                optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
            });

            const server = await device.gatt.connect();
            const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
            const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');

            setPrinterDevice({ device, characteristic });
            onNotify(`✅ Impresora conectada: ${device.name}`);
        } catch (error) {
            // NotFoundError tiene DOS causas posibles:
            //   a) Usuario canceló el selector de dispositivos → sin notificación
            //   b) Usuario rechazó el diálogo "¿Activar Bluetooth?" → tampoco notificar,
            //      porque ya vio el diálogo del sistema y eligió no activarlo.
            // En ambos casos la acción correcta es no molestar con un error extra.
            if (error.name === 'NotFoundError') return;

            // NotSupportedError: el dispositivo no tiene adaptador BT o está deshabilitado
            // a nivel de hardware/SO (raro, pero posible en tablets sin BT).
            if (error.name === 'NotSupportedError') {
                onNotify('❌ Bluetooth no disponible en este dispositivo.');
                return;
            }

            // SecurityError: el contexto no es seguro (HTTP) o falta user gesture.
            if (error.name === 'SecurityError') {
                onNotify('❌ Permiso de Bluetooth denegado. Revisá la configuración del sitio.');
                return;
            }

            // Cualquier otro error (GATT connection failed, service not found, etc.)
            console.error('[usePrinter] connectBluetooth:', error.name, error.message);
            onNotify('❌ No se pudo conectar la impresora. Verificá que esté encendida y cercana.');
        }
    };

    // --- GENERADOR DE TEXTO DEL TICKET ---
    // Diseñado para impresoras térmicas de 57mm con RawBT.
    // 57mm = 32 caracteres por línea en fuente estándar.
    // Se usa padding manual de espacios en lugar de ALIGN_RIGHT para los items,
    // porque ALIGN_RIGHT via base64/RawBT a veces no se aplica correctamente
    // y termina pegado al texto anterior (bug visible en el ticket físico).
    const CHARS_PER_LINE = 32;

    // Rellena con espacios para que 'right' quede pegado al margen derecho.
    // Si el contenido no entra en una línea, pone 'right' en la línea siguiente.
    const padRight = (left, right) => {
        const spaces = CHARS_PER_LINE - left.length - right.length;
        if (spaces < 1) {
            // No entra en una sola línea: precio en la siguiente línea indentado
            return left + '\n' + ' '.repeat(CHARS_PER_LINE - right.length) + right;
        }
        return left + ' '.repeat(spaces) + right;
    };

    // Divide un texto largo en líneas de máximo CHARS_PER_LINE caracteres,
    // respetando palabras completas cuando es posible.
    const wrapText = (text, maxLen = CHARS_PER_LINE) => {
        if (text.length <= maxLen) return [text];
        const lines = [];
        let remaining = text;
        while (remaining.length > maxLen) {
            // Buscar último espacio antes del límite para cortar por palabra
            let cut = remaining.lastIndexOf(' ', maxLen);
            if (cut <= 0) cut = maxLen; // sin espacios → corte duro
            lines.push(remaining.substring(0, cut).trim());
            remaining = remaining.substring(cut).trim();
        }
        if (remaining) lines.push(remaining);
        return lines;
    };

    const SEP = '-'.repeat(CHARS_PER_LINE);

    const generateReceiptText = (transaction, storeProfile) => {
        const storeName = storeProfile?.name || 'MiNegocio';
        const date = transaction.date?.seconds
            ? new Date(transaction.date.seconds * 1000).toLocaleString('es-AR')
            : new Date().toLocaleString('es-AR');

        let text = INIT;

        // ── CABECERA ──────────────────────────────────────────────────────────
        text += ALIGN_CENTER + BOLD_ON + storeName.toUpperCase() + '\n' + BOLD_OFF;
        text += 'Ticket de Venta\n';
        text += ALIGN_LEFT + SEP + '\n';

        // ── META ──────────────────────────────────────────────────────────────
        text += `Fecha: ${date}\n`;
        text += `Ticket: ${transaction.id?.substring(0, 8) || 'N/A'}\n`;
        text += SEP + '\n';

        // ── ITEMS ─────────────────────────────────────────────────────────────
        // Formato por item:
        //   Nombre del producto (sin truncar, wrapping por palabra si >32 chars)
        //     2 x $1.500         $3.000
        (transaction.items ?? []).forEach(item => {
            const qty       = item.qty || item.quantity || 1;
            const unitPrice = item.price ?? 0;
            const itemTotal = unitPrice * qty;

            const unitStr  = `$${unitPrice.toLocaleString('es-AR')}`;
            const totalStr = `$${itemTotal.toLocaleString('es-AR')}`;

            // Nombre completo, con wrap si es muy largo
            const nameLines = wrapText(item.name ?? 'Producto');
            nameLines.forEach(line => { text += line + '\n'; });

            // Segunda línea: cantidad × precio unitario → total (alineado a la derecha)
            const leftPart = `  ${qty} x ${unitStr}`;
            text += padRight(leftPart, totalStr) + '\n';
        });

        // ── TOTAL ─────────────────────────────────────────────────────────────
        text += SEP + '\n';
        const totalLine = padRight(BOLD_ON + 'TOTAL:', `$${(transaction.total ?? 0).toLocaleString('es-AR')}` + BOLD_OFF);
        text += totalLine + '\n';
        text += SEP + '\n';

        // Método de pago (si está disponible)
        if (transaction.paymentMethod && transaction.paymentMethod !== 'unspecified') {
            const metodosLabel = {
                cash:     'Efectivo',
                transfer: 'Transferencia',
                card:     'Tarjeta',
                digital:  'Digital',
            };
            const metodoStr = metodosLabel[transaction.paymentMethod] || transaction.paymentMethod;
            text += ALIGN_CENTER + `Pago: ${metodoStr}\n`;
        }

        // ── PIE ───────────────────────────────────────────────────────────────
        text += ALIGN_CENTER + '\nGracias por su compra!\n\n\n';
        text += CUT;

        return text;
    };

    // --- NUEVA FUNCIÓN: printTicket (La que busca Modals.jsx) ---
    const printTicket = async (transaction, storeProfile) => {
        setIsPrinting(true);
        try {
            // Si hay un dispositivo Bluetooth conectado, usamos ese.
            // Si no, usamos el método RawBT (ideal para móviles).
            if (printerDevice) {
                await printBluetooth(transaction, storeProfile);
            } else {
                await printRawBT(transaction, storeProfile);
            }
        } catch (error) {
            console.error("Error en impresión:", error);
        } finally {
            setIsPrinting(false);
        }
    };

    const printRawBT = async (transaction, storeProfile) => {
        // Verificar disponibilidad de Bluetooth antes de enviar a RawBT.
        // getAvailability() devuelve false si el adaptador BT no existe o está
        // desactivado a nivel de sistema. Si está apagado por el usuario, en
        // Android Chrome devuelve false también.
        if ('bluetooth' in navigator) {
            try {
                const available = await navigator.bluetooth.getAvailability();
                if (!available) {
                    onNotify('📶 Bluetooth apagado. Activalo para imprimir con RawBT.');
                    return;
                }
            } catch {
                // getAvailability puede fallar en contextos restrictivos.
                // En ese caso continuamos e intentamos enviar igual.
            }
        }

        const text = generateReceiptText(transaction, storeProfile);
        const base64 = btoa(text);

        // ✅ Detectamos si RawBT está instalado usando un iframe oculto.
        // Si el scheme rawbt:// no está registrado, el iframe no dispara nada
        // y mostramos un mensaje al usuario en lugar de silencio.
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        let appOpened = false;
        const handleBlur = () => { appOpened = true; };
        window.addEventListener('blur', handleBlur);

        iframe.src = `rawbt:base64,${base64}`;

        setTimeout(() => {
            window.removeEventListener('blur', handleBlur);
            document.body.removeChild(iframe);
            if (!appOpened) {
                // ✅ FIX: reemplazado alert() por onNotify
                onNotify('⚠️ No se encontró la app RawBT. Instalala desde Play Store.');
            }
        }, 1500);
    };

    const printBluetooth = async (transaction, storeProfile) => {
        if (!printerDevice) return;
        const text = generateReceiptText(transaction, storeProfile);
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const chunkSize = 512;
        for (let i = 0; i < data.length; i += chunkSize) {
            const chunk = data.slice(i, i + chunkSize);
            await printerDevice.characteristic.writeValue(chunk);
        }
    };

    return {
        connectBluetooth,
        printBluetooth,
        printRawBT,
        printTicket, // <--- EXPORTADA CORRECTAMENTE
        isPrinting,
        isConnected: !!printerDevice
    };
};