import { useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// COMANDOS ESC/POS — Uint8Array puro, sin strings Unicode
// ─────────────────────────────────────────────────────────────────────────────
const INIT      = new Uint8Array([0x1B, 0x40]);
const FEED_DOTS = (n) => new Uint8Array([0x1D, 0x4A, Math.min(n, 255)]);
const CUT       = new Uint8Array([0x1D, 0x56, 0x42, 0x00]);
const BOLD_ON   = new Uint8Array([0x1B, 0x45, 0x01]);
const BOLD_OFF  = new Uint8Array([0x1B, 0x45, 0x00]);
const ALIGN_L   = new Uint8Array([0x1B, 0x61, 0x00]);
const ALIGN_C   = new Uint8Array([0x1B, 0x61, 0x01]);
const FONT_2X   = new Uint8Array([0x1B, 0x21, 0x30]);
const FONT_1X   = new Uint8Array([0x1B, 0x21, 0x00]);

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSIÓN DE LOGO → ESC/POS RASTER con dithering Floyd-Steinberg
//
// Dithering difunde el error de cuantización a píxeles vecinos, produciendo
// una representación mucho más fiel del logo en 1-bit que el umbral simple.
// Contraste normalizado antes del dithering para logos con fondo claro/oscuro.
// ─────────────────────────────────────────────────────────────────────────────
const logoToEscPos = (logoUrl, maxWidthPx = 160) =>
    new Promise((resolve) => {
        if (!logoUrl) { resolve(null); return; }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const scale      = Math.min(1, maxWidthPx / img.width);
                const w          = Math.floor(img.width  * scale);
                const h          = Math.floor(img.height * scale);
                const widthBytes = Math.ceil(w / 8);

                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);

                const { data } = ctx.getImageData(0, 0, w, h);

                // 1. Convertir a escala de grises
                const gray = new Float32Array(w * h);
                for (let i = 0; i < w * h; i++) {
                    gray[i] = data[i*4]*0.299 + data[i*4+1]*0.587 + data[i*4+2]*0.114;
                }

                // 2. Normalizar contraste (stretch histogram a 0-255)
                let mn = 255, mx = 0;
                for (let i = 0; i < gray.length; i++) {
                    if (gray[i] < mn) mn = gray[i];
                    if (gray[i] > mx) mx = gray[i];
                }
                const range = mx - mn || 1;
                for (let i = 0; i < gray.length; i++) {
                    gray[i] = ((gray[i] - mn) / range) * 255;
                }

                // 3. Dithering Floyd-Steinberg
                // Difunde el error de cuantización a vecinos → resultado mucho
                // más nítido que umbral simple para logos con gradientes/colores.
                const imgBytes = new Uint8Array(widthBytes * h);
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const idx    = y * w + x;
                        const oldPx  = Math.min(255, Math.max(0, gray[idx]));
                        const newPx  = oldPx < 128 ? 0 : 255;
                        const err    = oldPx - newPx;
                        gray[idx]    = newPx;
                        // Difundir error a vecinos
                        if (x+1 < w)         gray[idx+1]   += err * 7/16;
                        if (y+1 < h) {
                            if (x > 0)       gray[idx+w-1] += err * 3/16;
                                             gray[idx+w]   += err * 5/16;
                            if (x+1 < w)     gray[idx+w+1] += err * 1/16;
                        }
                        if (newPx === 0) {   // pixel oscuro = impreso
                            imgBytes[y * widthBytes + Math.floor(x/8)] |= (0x80 >> (x % 8));
                        }
                    }
                }

                // 4. Armar comando GS v 0
                const header = new Uint8Array([
                    0x1D, 0x76, 0x30, 0x00,
                    widthBytes & 0xFF, (widthBytes >> 8) & 0xFF,
                    h & 0xFF, (h >> 8) & 0xFF,
                ]);
                const out = new Uint8Array(header.length + imgBytes.length);
                out.set(header); out.set(imgBytes, header.length);
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

    const CHARS = 32;
    const enc   = new TextEncoder();
    const txt   = (s) => enc.encode(s);

    const padRight = (left, right) => {
        const sp = CHARS - left.length - right.length;
        if (sp < 1) return left + '\n' + ' '.repeat(CHARS - right.length) + right;
        return left + ' '.repeat(sp) + right;
    };
    const wrapText = (text, maxLen = CHARS) => {
        if (text.length <= maxLen) return [text];
        const lines = []; let rem = text;
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
        return ' '.repeat(Math.floor((w - s.length) / 2)) + s;
    };

    // ASCII puro — ningún carácter Unicode de más de 1 byte
    const SEP  = '='.repeat(CHARS);
    const SEP2 = '-'.repeat(CHARS);

    // ── CONSTRUCCIÓN DEL TICKET ───────────────────────────────────────────────
    const buildReceipt = async (transaction, storeProfile) => {
        const parts = [];
        const add    = (...cs) => cs.forEach(c => parts.push(c));
        const addTxt = (s) => parts.push(txt(s));

        const storeName = (storeProfile?.name || 'Mi Negocio').toUpperCase();
        const date = transaction.date?.seconds
            ? new Date(transaction.date.seconds * 1000).toLocaleString('es-AR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
              })
            : new Date().toLocaleString('es-AR');

        add(INIT);

        // ── LOGO ─────────────────────────────────────────────────────────────
        if (storeProfile?.logoUrl) {
            const logoData = await logoToEscPos(storeProfile.logoUrl, 160);
            if (logoData) {
                add(ALIGN_C, logoData);
                addTxt('\n\n');
            }
        }

        // ── NOMBRE TIENDA (doble tamaño) ──────────────────────────────────────
        add(ALIGN_C, FONT_2X, BOLD_ON);
        wrapText(storeName, 16).forEach(line => addTxt(line + '\n'));
        add(BOLD_OFF, FONT_1X);
        addTxt('\n');

        // ── META ──────────────────────────────────────────────────────────────
        add(ALIGN_L);
        addTxt(SEP + '\n');
        addTxt(`Fecha:   ${date}\n`);
        addTxt(`Ticket:  #${(transaction.id?.substring(0,8) || 'N/A').toUpperCase()}\n`);
        const cname = transaction.clientName;
        if (cname && cname !== 'Anonimo' && cname !== 'Anonimo' && cname !== 'An\u00f3nimo') {
            addTxt(`Cliente: ${cname}\n`);
        }
        if (transaction.clientInfo?.address) {
            addTxt(`Dir:     ${transaction.clientInfo.address}\n`);
        }
        addTxt(SEP + '\n');

        // ── ENCABEZADO TABLA ──────────────────────────────────────────────────
        add(BOLD_ON);
        addTxt(padRight('PRODUCTO', 'TOTAL') + '\n');
        add(BOLD_OFF);
        addTxt(SEP2 + '\n');

        // ── ITEMS ─────────────────────────────────────────────────────────────
        const items = transaction.items ?? [];
        items.forEach((item, idx) => {
            const qty      = Number(item.qty || item.quantity || 1);
            const price    = Number(item.price ?? 0);
            const total    = price * qty;
            const totalStr = '$' + total.toLocaleString('es-AR');
            const unitStr  = '$' + price.toLocaleString('es-AR');

            const nameLines = wrapText(item.name ?? 'Producto');
            addTxt(padRight(nameLines[0], totalStr) + '\n');
            nameLines.slice(1).forEach(l => addTxt('  ' + l + '\n'));
            if (qty > 1) addTxt(`  ${qty} x ${unitStr}\n`);
            if (idx < items.length - 1) addTxt(SEP2 + '\n');
        });

        // ── TOTAL ─────────────────────────────────────────────────────────────
        addTxt(SEP + '\n');
        add(ALIGN_C, BOLD_ON);
        addTxt('TOTAL\n');
        add(FONT_2X);
        addTxt('$' + (transaction.total ?? 0).toLocaleString('es-AR') + '\n');
        add(FONT_1X, BOLD_OFF, ALIGN_L);
        addTxt(SEP + '\n');

        // ── PAGO ──────────────────────────────────────────────────────────────
        const metodos = { cash:'Efectivo', transfer:'Transferencia', card:'Tarjeta', digital:'Digital' };
        if (transaction.paymentMethod && transaction.paymentMethod !== 'unspecified') {
            addTxt(center('[ ' + (metodos[transaction.paymentMethod] || transaction.paymentMethod) + ' ]') + '\n');
        }
        if (transaction.paymentStatus === 'pending') {
            add(BOLD_ON);
            addTxt(center('*** PENDIENTE DE PAGO ***') + '\n');
            add(BOLD_OFF);
        } else if (transaction.paymentStatus === 'partial') {
            const paid = transaction.amountPaid ?? 0;
            addTxt(center('Abonado: $' + paid.toLocaleString('es-AR')) + '\n');
            add(BOLD_ON);
            addTxt(center('Saldo:   $' + ((transaction.total ?? 0) - paid).toLocaleString('es-AR')) + '\n');
            add(BOLD_OFF);
        }

        // ── PIE ───────────────────────────────────────────────────────────────
        addTxt('\n');
        add(ALIGN_C);
        addTxt(SEP2 + '\n');
        addTxt('Gracias por su compra!\n');
        addTxt(storeName + '\n');
        addTxt(SEP2 + '\n');

        // ── FEED + CORTE ──────────────────────────────────────────────────────
        addTxt('\n\n\n');
        add(FEED_DOTS(250), CUT);

        // Concatenar
        const totalLen = parts.reduce((s, p) => s + p.length, 0);
        const result = new Uint8Array(totalLen);
        let offset = 0;
        for (const p of parts) { result.set(p, offset); offset += p.length; }
        return result;
    };

    // ── ENVÍO POR GATT ────────────────────────────────────────────────────────
    // Delay de 20ms entre chunks: da tiempo al buffer interno de la impresora
    // (típicamente 4KB) de procesar los datos antes de recibir más.
    // Sin este delay, la impresora descarta los chunks posteriores al logo
    // y el texto de la venta nunca llega a imprimirse.
    const sendToPrinter = async (device, data) => {
        const chunkSize = 512;
        for (let i = 0; i < data.length; i += chunkSize) {
            await device.characteristic.writeValue(data.slice(i, i + chunkSize));
            await new Promise(r => setTimeout(r, 20));
        }
    };

    // ── IMPRIMIR ──────────────────────────────────────────────────────────────
    const printTicket = async (transaction, storeProfile) => {
        if (!('bluetooth' in navigator)) {
            onNotify('No soporta Bluetooth. Usa Chrome en Android.');
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
                onNotify(`Conectado a ${device.name}`);
                await sendToPrinter(newDevice, receiptData);
            } else {
                await sendToPrinter(printerDevice, receiptData);
            }
        } catch (error) {
            setIsConnecting(false);
            if (error.name === 'NotFoundError') return;
            if (error.name === 'NotSupportedError') { onNotify('Bluetooth no disponible en este dispositivo.'); return; }
            if (error.name === 'SecurityError') { onNotify('Permiso de Bluetooth denegado.'); return; }
            console.error('[usePrinter] printTicket:', error.name, error.message);
            onNotify('Error al imprimir. Verifica que la impresora este encendida y cerca.');
        } finally {
            setIsPrinting(false);
        }
    };

    // ── CONECTAR ──────────────────────────────────────────────────────────────
    const connectBluetooth = async () => {
        if (!('bluetooth' in navigator)) { onNotify('Usa Chrome en Android.'); return; }
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
            onNotify(`Impresora conectada: ${device.name}`);
        } catch (error) {
            if (error.name === 'NotFoundError') return;
            if (error.name === 'NotSupportedError') { onNotify('Bluetooth no disponible.'); return; }
            if (error.name === 'SecurityError') { onNotify('Permiso denegado.'); return; }
            console.error('[usePrinter] connectBluetooth:', error.name, error.message);
            onNotify('No se pudo conectar. Verifica que este encendida y cercana.');
        } finally {
            setIsConnecting(false);
        }
    };

    // ── DESCONECTAR ───────────────────────────────────────────────────────────
    const disconnectBluetooth = () => {
        if (printerDevice?.device?.gatt?.connected) printerDevice.device.gatt.disconnect();
        setPrinterDevice(null);
        onNotify('Impresora desconectada.');
    };

    return { connectBluetooth, disconnectBluetooth, printTicket, isPrinting, isConnecting, isConnected: !!printerDevice, printerName: printerDevice?.device?.name || null };
};
