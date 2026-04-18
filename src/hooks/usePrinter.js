import { useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// COMANDOS ESC/POS
// ─────────────────────────────────────────────────────────────────────────────
const ESC  = '\x1B';
const GS   = '\x1D';
const INIT = ESC + '@';            // Reset completo de la impresora

// Feed de N puntos antes del corte (soluciona ticket corto que hay que tirar)
// 120 dots ≈ 9mm de avance — suficiente para cualquier impresora de 57mm/80mm
const FEED_DOTS  = (n) => GS + 'J' + String.fromCharCode(n);
const CUT        = GS + 'V' + '\x42' + '\x00'; // corte parcial

const BOLD_ON      = ESC + 'E' + '\x01';
const BOLD_OFF     = ESC + 'E' + '\x00';
const ALIGN_LEFT   = ESC + 'a' + '\x00';
const ALIGN_CENTER = ESC + 'a' + '\x01';

// Doble alto + doble ancho: simula "logo tipográfico" que ocupa todo el ancho
// del ticket. Las impresoras BT de bajo costo no soportan impresión de imágenes,
// pero FONT_2X imprime el nombre de la tienda de forma prominente y profesional.
const FONT_2X     = ESC + '!' + '\x30';
const FONT_NORMAL = ESC + '!' + '\x00';

export const usePrinter = (onNotify = () => {}) => {
    const [isPrinting, setIsPrinting]         = useState(false);
    const [isConnecting, setIsConnecting]     = useState(false);
    const [printerDevice, setPrinterDevice]   = useState(null);

    // ── HELPERS DE FORMATO ────────────────────────────────────────────────────
    // 57mm = 32 chars/línea en fuente normal. Con FONT_2X (doble ancho) = 16 chars.
    const CHARS_PER_LINE    = 32;
    const CHARS_PER_LINE_2X = 16;

    const padRight = (left, right) => {
        const spaces = CHARS_PER_LINE - left.length - right.length;
        if (spaces < 1)
            return left + '\n' + ' '.repeat(CHARS_PER_LINE - right.length) + right;
        return left + ' '.repeat(spaces) + right;
    };

    const wrapText = (text, maxLen = CHARS_PER_LINE) => {
        if (text.length <= maxLen) return [text];
        const lines = [];
        let remaining = text;
        while (remaining.length > maxLen) {
            let cut = remaining.lastIndexOf(' ', maxLen);
            if (cut <= 0) cut = maxLen;
            lines.push(remaining.substring(0, cut).trim());
            remaining = remaining.substring(cut).trim();
        }
        if (remaining) lines.push(remaining);
        return lines;
    };

    const SEP_SOLID  = '\u2550'.repeat(CHARS_PER_LINE); // ══════ (grueso visual)
    const SEP_DASHED = '-'.repeat(CHARS_PER_LINE);       // ------ (fino)

    // ── GENERADOR DEL TICKET ──────────────────────────────────────────────────
    const generateReceiptText = (transaction, storeProfile) => {
        const storeName = (storeProfile?.name || 'MiNegocio').toUpperCase();
        const date = transaction.date?.seconds
            ? new Date(transaction.date.seconds * 1000).toLocaleString('es-AR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
              })
            : new Date().toLocaleString('es-AR');

        let t = INIT;

        // ── CABECERA: "LOGO TIPOGRÁFICO" ──────────────────────────────────────
        // FONT_2X imprime cada carácter al doble de tamaño.
        // Con 16 chars por línea el nombre se parte automáticamente si es largo.
        t += ALIGN_CENTER + FONT_2X + BOLD_ON;
        wrapText(storeName, CHARS_PER_LINE_2X).forEach(line => { t += line + '\n'; });
        t += BOLD_OFF + FONT_NORMAL;
        t += ALIGN_CENTER + 'Distribuidora\n'; // subtitulo opcional
        t += '\n';

        // ── META ──────────────────────────────────────────────────────────────
        t += ALIGN_LEFT + SEP_SOLID + '\n';
        t += `Fecha:   ${date}\n`;
        t += `Ticket:  #${(transaction.id?.substring(0, 8) || 'N/A').toUpperCase()}\n`;
        if (transaction.clientName && transaction.clientName !== 'Anónimo') {
            t += `Cliente: ${transaction.clientName}\n`;
        }
        t += SEP_SOLID + '\n';

        // ── ENCABEZADO DE TABLA ───────────────────────────────────────────────
        t += BOLD_ON + padRight('PRODUCTO', 'TOTAL') + BOLD_OFF + '\n';
        t += SEP_DASHED + '\n';

        // ── ITEMS ─────────────────────────────────────────────────────────────
        const items = transaction.items ?? [];
        items.forEach((item, idx) => {
            const qty       = item.qty || item.quantity || 1;
            const unitPrice = item.price ?? 0;
            const itemTotal = unitPrice * qty;
            const totalStr  = `$${itemTotal.toLocaleString('es-AR')}`;
            const unitStr   = `$${unitPrice.toLocaleString('es-AR')}`;

            const nameLines = wrapText(item.name ?? 'Producto');
            // Primera línea: nombre + total alineado a la derecha
            t += padRight(nameLines[0], totalStr) + '\n';
            // Continuación si el nombre era largo
            nameLines.slice(1).forEach(l => { t += '  ' + l + '\n'; });
            // Detalle qty × precio unitario solo cuando hay más de 1 unidad
            if (qty > 1) {
                t += `  ${qty} x ${unitStr}\n`;
            }
            // Separador fino entre items (no después del último)
            if (idx < items.length - 1) t += SEP_DASHED + '\n';
        });

        // ── TOTAL ─────────────────────────────────────────────────────────────
        t += SEP_SOLID + '\n';
        // "TOTAL" en tamaño normal + monto en doble tamaño centrado
        t += BOLD_ON + ALIGN_CENTER + 'TOTAL\n' + BOLD_OFF;
        const totalAmount = `$${(transaction.total ?? 0).toLocaleString('es-AR')}`;
        t += ALIGN_CENTER + FONT_2X + BOLD_ON + totalAmount + '\n' + BOLD_OFF + FONT_NORMAL;
        t += ALIGN_LEFT + SEP_SOLID + '\n';

        // ── MÉTODO + ESTADO DE PAGO ───────────────────────────────────────────
        if (transaction.paymentMethod && transaction.paymentMethod !== 'unspecified') {
            const metodosLabel = {
                cash: 'Efectivo', transfer: 'Transferencia',
                card: 'Tarjeta',  digital: 'Digital',
            };
            const metodoStr = metodosLabel[transaction.paymentMethod] || transaction.paymentMethod;
            t += ALIGN_CENTER + `[ Pago: ${metodoStr} ]\n`;
        }

        if (transaction.paymentStatus === 'pending') {
            t += ALIGN_CENTER + BOLD_ON + '\n*** PENDIENTE DE PAGO ***\n' + BOLD_OFF;
        } else if (transaction.paymentStatus === 'partial') {
            const paid = transaction.amountPaid ?? 0;
            const remaining = (transaction.total ?? 0) - paid;
            t += ALIGN_CENTER + `Abonado: $${paid.toLocaleString('es-AR')}\n`;
            t += ALIGN_CENTER + BOLD_ON + `Saldo:   $${remaining.toLocaleString('es-AR')}\n` + BOLD_OFF;
        }

        // ── PIE ───────────────────────────────────────────────────────────────
        t += '\n';
        t += ALIGN_CENTER + SEP_DASHED + '\n';
        t += ALIGN_CENTER + 'Gracias por su compra!\n';
        t += ALIGN_CENTER + storeName + '\n';
        t += ALIGN_CENTER + SEP_DASHED + '\n';

        // ── FEED + CORTE ──────────────────────────────────────────────────────
        // 3 saltos + FEED_DOTS(250) → avanza ~18mm antes del corte.
        // Con 120 dots la línea de perforaciones quedaba debajo del cabezal
        // de corte. 250 dots (a 203 DPI) asegura que el contenido pase por
        // encima del punto de corte en impresoras de 57mm y 80mm.
        t += '\n\n\n';
        t += FEED_DOTS(250);
        t += CUT;

        return t;
    };

    // ── ENVÍO A LA IMPRESORA (GATT) ───────────────────────────────────────────
    const sendToPrinter = async (device, transaction, storeProfile) => {
        const text = generateReceiptText(transaction, storeProfile);
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const chunkSize = 512;
        for (let i = 0; i < data.length; i += chunkSize) {
            await device.characteristic.writeValue(data.slice(i, i + chunkSize));
        }
    };

    // ── IMPRIMIR TICKET (flujo unificado sin RawBT) ───────────────────────────
    // Si hay impresora conectada → imprime directo.
    // Si no → abre el selector BT nativo, conecta y luego imprime en un solo gesto.
    const printTicket = async (transaction, storeProfile) => {
        if (!('bluetooth' in navigator)) {
            onNotify('❌ Tu navegador no soporta Bluetooth. Usá Chrome en Android.');
            return;
        }
        setIsPrinting(true);
        try {
            if (!printerDevice) {
                setIsConnecting(true);
                const device = await navigator.bluetooth.requestDevice({
                    filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
                    optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
                });
                const server         = await device.gatt.connect();
                const service        = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
                const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
                const newDevice      = { device, characteristic };
                setPrinterDevice(newDevice);
                setIsConnecting(false);
                onNotify(`✅ Conectado a ${device.name}`);
                await sendToPrinter(newDevice, transaction, storeProfile);
            } else {
                await sendToPrinter(printerDevice, transaction, storeProfile);
            }
        } catch (error) {
            setIsConnecting(false);
            if (error.name === 'NotFoundError') return;
            if (error.name === 'NotSupportedError') { onNotify('❌ Bluetooth no disponible en este dispositivo.'); return; }
            if (error.name === 'SecurityError') { onNotify('❌ Permiso de Bluetooth denegado. Revisá la configuración del sitio.'); return; }
            console.error('[usePrinter] printTicket:', error.name, error.message);
            onNotify('❌ Error al imprimir. Verificá que la impresora esté encendida y cerca.');
        } finally {
            setIsPrinting(false);
        }
    };

    // ── CONECTAR (botón secundario, para pre-parear o cambiar impresora) ──────
    const connectBluetooth = async () => {
        if (!('bluetooth' in navigator)) {
            onNotify('❌ Tu navegador no soporta Bluetooth. Usá Chrome en Android.');
            return;
        }
        setIsConnecting(true);
        try {
            const device         = await navigator.bluetooth.requestDevice({
                filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
                optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
            });
            const server         = await device.gatt.connect();
            const service        = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
            const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
            setPrinterDevice({ device, characteristic });
            onNotify(`✅ Impresora conectada: ${device.name}`);
        } catch (error) {
            if (error.name === 'NotFoundError') return;
            if (error.name === 'NotSupportedError') { onNotify('❌ Bluetooth no disponible en este dispositivo.'); return; }
            if (error.name === 'SecurityError') { onNotify('❌ Permiso denegado. Revisá la configuración del sitio.'); return; }
            console.error('[usePrinter] connectBluetooth:', error.name, error.message);
            onNotify('❌ No se pudo conectar la impresora. Verificá que esté encendida y cercana.');
        } finally {
            setIsConnecting(false);
        }
    };

    // ── DESCONECTAR ───────────────────────────────────────────────────────────
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
        isConnecting,
        isConnected: !!printerDevice,
        printerName: printerDevice?.device?.name || null,
    };
};
