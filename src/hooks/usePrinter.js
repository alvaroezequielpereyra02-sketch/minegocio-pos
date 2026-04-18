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
    // --- 1. CONEXIÓN Y TICKET ---

    // --- GENERADOR DE TEXTO DEL TICKET ---
    // Diseñado para impresoras térmicas de 57mm (ESC/POS via Web Bluetooth directo).
    // 57mm = 32 caracteres por línea en fuente estándar.
    // Se usa padding manual de espacios en lugar de ALIGN_RIGHT para los items,
    // porque ALIGN_RIGHT a veces no se aplica correctamente en impresoras térmicas baratas
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

    // --- IMPRESIÓN PRINCIPAL ---
    // Flujo unificado sin RawBT:
    //   1. Si ya hay impresora conectada → imprime directo
    //   2. Si no hay impresora → abre el selector BT nativo, conecta y luego imprime
    //      en un solo gesto (el usuario no necesita tocar "Conectar" por separado)
    //
    // Esto elimina la dependencia de RawBT (app paga) sin perder ninguna funcionalidad.
    // printBluetooth() ya enviaba ESC/POS directo por GATT — era la misma ruta final.
    const printTicket = async (transaction, storeProfile) => {
        if (!('bluetooth' in navigator)) {
            onNotify('❌ Tu navegador no soporta Bluetooth. Usá Chrome en Android.');
            return;
        }

        setIsPrinting(true);
        try {
            // Si no hay dispositivo conectado, conectar primero y luego imprimir
            if (!printerDevice) {
                const device = await navigator.bluetooth.requestDevice({
                    filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
                    optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
                });
                const server = await device.gatt.connect();
                const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
                const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');

                // Guardar para futuras impresiones en la misma sesión
                const newDevice = { device, characteristic };
                setPrinterDevice(newDevice);
                onNotify(`✅ Conectado a ${device.name}`);

                // Imprimir inmediatamente con el dispositivo recién conectado
                await sendToPrinter(newDevice, transaction, storeProfile);
            } else {
                await sendToPrinter(printerDevice, transaction, storeProfile);
            }
        } catch (error) {
            if (error.name === 'NotFoundError') {
                // Usuario canceló el selector BT — sin notificación
                return;
            }
            if (error.name === 'NotSupportedError') {
                onNotify('❌ Bluetooth no disponible en este dispositivo.');
                return;
            }
            if (error.name === 'SecurityError') {
                onNotify('❌ Permiso de Bluetooth denegado. Revisá la configuración del sitio.');
                return;
            }
            console.error('[usePrinter] printTicket:', error.name, error.message);
            onNotify('❌ Error al imprimir. Verificá que la impresora esté encendida y cerca.');
        } finally {
            setIsPrinting(false);
        }
    };

    // Función interna — envía el ticket a un dispositivo GATT ya conectado
    const sendToPrinter = async (device, transaction, storeProfile) => {
        const text = generateReceiptText(transaction, storeProfile);
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const chunkSize = 512;
        for (let i = 0; i < data.length; i += chunkSize) {
            const chunk = data.slice(i, i + chunkSize);
            await device.characteristic.writeValue(chunk);
        }
    };

    // Mantener connectBluetooth para el botón secundario "Conectar impresora"
    // (permite pre-parear sin imprimir, o cambiar de impresora)
    const connectBluetooth = async () => {
        if (!('bluetooth' in navigator)) {
            onNotify('❌ Tu navegador no soporta Bluetooth. Usá Chrome en Android.');
            return;
        }
        try {
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
            if (error.name === 'NotFoundError') return;
            if (error.name === 'NotSupportedError') { onNotify('❌ Bluetooth no disponible en este dispositivo.'); return; }
            if (error.name === 'SecurityError') { onNotify('❌ Permiso denegado. Revisá la configuración del sitio.'); return; }
            console.error('[usePrinter] connectBluetooth:', error.name, error.message);
            onNotify('❌ No se pudo conectar la impresora. Verificá que esté encendida y cercana.');
        }
    };

    const disconnectBluetooth = () => {
        if (printerDevice?.device?.gatt?.connected) {
            printerDevice.device.gatt.disconnect();
        }
        setPrinterDevice(null);
        onNotify('🔌 Impresora desconectada.');
    };

    return {
        connectBluetooth,
        disconnectBluetooth,
        printTicket,
        isPrinting,
        isConnected: !!printerDevice,
        printerName: printerDevice?.device?.name || null,
    };
};