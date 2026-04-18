import { useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// COMANDOS ESC/POS — solo bytes ASCII/binario puro
// IMPORTANTE: no usar caracteres Unicode (U+0080 en adelante) en ninguna
// cadena de texto del ticket. Los bytes multi-byte UTF-8 que genera TextEncoder
// para caracteres como ═ (U+2550 → E2 95 90) corrompen el parser ESC/POS
// de la impresora, que los interpreta como secuencias de comandos inválidas
// y descarta todo el contenido que sigue (incluidos los ítems del pedido).
// ─────────────────────────────────────────────────────────────────────────────
const ESC  = '\x1B';
const GS   = '\x1D';
const INIT       = new Uint8Array([0x1B, 0x40]);
const FEED_DOTS  = (n) => new Uint8Array([0x1D, 0x4A, n]);  // GS J n
const CUT        = new Uint8Array([0x1D, 0x56, 0x42, 0x00]); // GS V 66 0 — corte parcial

const BOLD_ON    = new Uint8Array([0x1B, 0x45, 0x01]);
const BOLD_OFF   = new Uint8Array([0x1B, 0x45, 0x00]);
const ALIGN_L    = new Uint8Array([0x1B, 0x61, 0x00]);
const ALIGN_C    = new Uint8Array([0x1B, 0x61, 0x01]);
const FONT_2X    = new Uint8Array([0x1B, 0x21, 0x30]); // doble alto + doble ancho
const FONT_1X    = new Uint8Array([0x1B, 0x21, 0x00]); // normal

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSIÓN DE IMAGEN A ESC/POS RASTER (GS v 0)
// Convierte la URL del logo en datos de bitmap 1-bit para impresión térmica.
// Compatible con impresoras de 57mm (ancho máx: 384px a 203 DPI)
// ─────────────────────────────────────────────────────────────────────────────
const logoToEscPos = (logoUrl, maxWidthPx = 200) =>
    new Promise((resolve) => {
        if (!logoUrl) { resolve(null); return; }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const scale = Math.min(1, maxWidthPx / img.width);
                const w = Math.floor(img.width * scale);
                const h = Math.floor(img.height * scale);
                const widthBytes = Math.ceil(w / 8);

                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);

                const { data } = ctx.getImageData(0, 0, w, h);
                const imgBytes = new Uint8Array(widthBytes * h);
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const i = (y * w + x) * 4;
                        const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                        if (lum < 128) {  // pixel oscuro → impreso
                            imgBytes[y * widthBytes + Math.floor(x / 8)] |= (0x80 >> (x % 8));
                        }
                    }
                }

                // GS v 0: [1D 76 30 00] + widthLo widthHi + heightLo heightHi + datos
                const header = new Uint8Array([
                    0x1D, 0x76, 0x30, 0x00,
                    widthBytes & 0xFF, (widthBytes >> 8) & 0xFF,
                    h & 0xFF, (h >> 8) & 0xFF,
                ]);
                const out = new Uint8Array(header.length + imgBytes.length);
                out.set(header);
                out.set(imgBytes, header.length);
                resolve(out);
            } catch { resolve(null); }
        };
        img.onerror = () => resolve(null);
        img.src = logoUrl;
    });

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────
export const usePrinter = (onNotify = () => {}) => {
    const [isPrinting, setIsPrinting]       = useState(false);
    const [isConnecting, setIsConnecting]   = useState(false);
    const [printerDevice, setPrinterDevice] = useState(null);

    const CHARS = 32; // 57mm = 32 chars/línea en fuente normal

    const txt = (s) => new TextEncoder().encode(s); // helper: string → Uint8Array

    const padRight = (left, right) => {
        const spaces = CHARS - left.length - right.length;
        if (spaces < 1) return left + '\n' + ' '.repeat(CHARS - right.length) + right;
        return left + ' '.repeat(spaces) + right;
    };

    const wrapText = (text, maxLen = CHARS) => {
        if (text.length <= maxLen) return [text];
        const lines = [];
        let rem = text;
        while (rem.length > maxLen) {
            let cut = rem.lastIndexOf(' ', maxLen);
            if (cut <= 0) cut = maxLen;
            lines.push(rem.substring(0, cut).trim());
            rem = rem.substring(cut).trim();
        }
        if (rem) lines.push(rem);
        return lines;
    };

    const center = (s, w = CHARS) => {
        if (s.length >= w) return s;
        const pad = Math.floor((w - s.length) / 2);
        return ' '.repeat(pad) + s;
    };

    // ASCII puro — no usar Unicode de más de 1 byte
    const SEP  = '='.repeat(CHARS);  // separador grueso
    const SEP2 = '-'.repeat(CHARS);  // separador fino

    // ── CONSTRUCCIÓN DEL TICKET ────────────────────────────────────────────────
    // Devuelve Uint8Array con comandos ESC/POS + texto + datos de imagen
    const buildReceipt = async (transaction, storeProfile) => {
        const parts = [];
        const add = (...chunks) => chunks.forEach(c => parts.push(c));
        const addTxt = (s) => parts.push(txt(s));

        const storeName = (storeProfile?.name || 'Mi Negocio').toUpperCase();
        const date = transaction.date?.seconds
            ? new Date(transaction.date.seconds * 1000).toLocaleString('es-AR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
              })
            : new Date().toLocaleString('es-AR');

        add(INIT);

        // ── LOGO ────────────────────────────────────────────────────────────────
        if (storeProfile?.logoUrl) {
            const logoData = await logoToEscPos(storeProfile.logoUrl, 200);
            if (logoData) {
                add(ALIGN_C, logoData);
                addTxt('\n');
            }
        }

        // ── NOMBRE DE LA TIENDA ─────────────────────────────────────────────────
        add(ALIGN_C, FONT_2X, BOLD_ON);
        // Con FONT_2X (doble ancho) caben 16 chars por línea
        wrapText(storeName, 16).forEach(line => { addTxt(line + '\n'); });
        add(BOLD_OFF, FONT_1X);
        addTxt('\n');

        // ── META ────────────────────────────────────────────────────────────────
        add(ALIGN_L);
        addTxt(SEP + '\n');
        addTxt(`Fecha:   ${date}\n`);
        addTxt(`Ticket:  #${(transaction.id?.substring(0, 8) || 'N/A').toUpperCase()}\n`);
        if (transaction.clientName && transaction.clientName !== 'Anonimo' && transaction.clientName !== 'Anónimo') {
            addTxt(`Cliente: ${transaction.clientName}\n`);
        }
        if (transaction.clientInfo?.address) {
            addTxt(`Dir:     ${transaction.clientInfo.address}\n`);
        }
        addTxt(SEP + '\n');

        // ── ENCABEZADO TABLA ────────────────────────────────────────────────────
        add(BOLD_ON);
        addTxt(padRight('PRODUCTO', 'TOTAL') + '\n');
        add(BOLD_OFF);
        addTxt(SEP2 + '\n');

        // ── ITEMS ───────────────────────────────────────────────────────────────
        const items = transaction.items ?? [];
        items.forEach((item, idx) => {
            const qty       = Number(item.qty || item.quantity || 1);
            const unitPrice = Number(item.price ?? 0);
            const itemTotal = unitPrice * qty;
            const totalStr  = '$' + itemTotal.toLocaleString('es-AR');
            const unitStr   = '$' + unitPrice.toLocaleString('es-AR');

            const nameLines = wrapText(item.name ?? 'Producto');
            addTxt(padRight(nameLines[0], totalStr) + '\n');
            nameLines.slice(1).forEach(l => addTxt('  ' + l + '\n'));
            if (qty > 1) addTxt(`  ${qty} x ${unitStr}\n`);
            if (idx < items.length - 1) addTxt(SEP2 + '\n');
        });

        // ── TOTAL ────────────────────────────────────────────────────────────────
        addTxt(SEP + '\n');
        add(ALIGN_C, BOLD_ON);
        addTxt('TOTAL\n');
        add(FONT_2X);
        addTxt('$' + (transaction.total ?? 0).toLocaleString('es-AR') + '\n');
        add(FONT_1X, BOLD_OFF, ALIGN_L);
        addTxt(SEP + '\n');

        // ── PAGO ─────────────────────────────────────────────────────────────────
        const metodos = { cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta', digital: 'Digital' };
        if (transaction.paymentMethod && transaction.paymentMethod !== 'unspecified') {
            addTxt(center(`[ ${metodos[transaction.paymentMethod] || transaction.paymentMethod} ]`) + '\n');
        }
        if (transaction.paymentStatus === 'pending') {
            add(BOLD_ON);
            addTxt(center('*** PENDIENTE DE PAGO ***') + '\n');
            add(BOLD_OFF);
        } else if (transaction.paymentStatus === 'partial') {
            const paid = transaction.amountPaid ?? 0;
            const saldo = (transaction.total ?? 0) - paid;
            addTxt(center(`Abonado: $${paid.toLocaleString('es-AR')}`) + '\n');
            add(BOLD_ON);
            addTxt(center(`Saldo:   $${saldo.toLocaleString('es-AR')}`) + '\n');
            add(BOLD_OFF);
        }

        // ── PIE ───────────────────────────────────────────────────────────────────
        addTxt('\n');
        add(ALIGN_C);
        addTxt(SEP2 + '\n');
        addTxt('Gracias por su compra!\n');
        addTxt(storeName + '\n');
        addTxt(SEP2 + '\n');

        // ── FEED + CORTE ──────────────────────────────────────────────────────────
        // 3 saltos + 250 dots (~18mm) garantizan que el contenido pase
        // completamente por encima del cabezal de corte.
        addTxt('\n\n\n');
        add(FEED_DOTS(250), CUT);

        // Concatenar todos los chunks en un único Uint8Array
        const total = parts.reduce((s, p) => s + p.length, 0);
        const result = new Uint8Array(total);
        let offset = 0;
        for (const p of parts) { result.set(p, offset); offset += p.length; }
        return result;
    };

    // ── ENVÍO POR GATT ────────────────────────────────────────────────────────
    const sendToPrinter = async (device, data) => {
        const chunkSize = 512;
        for (let i = 0; i < data.length; i += chunkSize) {
            await device.characteristic.writeValue(data.slice(i, i + chunkSize));
        }
    };

    // ── IMPRIMIR ──────────────────────────────────────────────────────────────
    const printTicket = async (transaction, storeProfile) => {
        if (!('bluetooth' in navigator)) {
            onNotify('❌ Tu navegador no soporta Bluetooth. Usa Chrome en Android.');
            return;
        }
        setIsPrinting(true);
        try {
            const receiptData = await buildReceipt(transaction, storeProfile);

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
                await sendToPrinter(newDevice, receiptData);
            } else {
                await sendToPrinter(printerDevice, receiptData);
            }
        } catch (error) {
            setIsConnecting(false);
            if (error.name === 'NotFoundError') return;
            if (error.name === 'NotSupportedError') { onNotify('❌ Bluetooth no disponible en este dispositivo.'); return; }
            if (error.name === 'SecurityError') { onNotify('❌ Permiso de Bluetooth denegado. Revisa la configuracion del sitio.'); return; }
            console.error('[usePrinter] printTicket:', error.name, error.message);
            onNotify('❌ Error al imprimir. Verifica que la impresora este encendida y cerca.');
        } finally {
            setIsPrinting(false);
        }
    };

    // ── CONECTAR (pre-parear o cambiar impresora) ─────────────────────────────
    const connectBluetooth = async () => {
        if (!('bluetooth' in navigator)) {
            onNotify('❌ Tu navegador no soporta Bluetooth. Usa Chrome en Android.');
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
            if (error.name === 'SecurityError') { onNotify('❌ Permiso denegado. Revisa la configuracion del sitio.'); return; }
            console.error('[usePrinter] connectBluetooth:', error.name, error.message);
            onNotify('❌ No se pudo conectar la impresora. Verifica que este encendida y cercana.');
        } finally {
            setIsConnecting(false);
        }
    };

    // ── DESCONECTAR ───────────────────────────────────────────────────────────
    const disconnectBluetooth = () => {
        if (printerDevice?.device?.gatt?.connected) printerDevice.device.gatt.disconnect();
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
