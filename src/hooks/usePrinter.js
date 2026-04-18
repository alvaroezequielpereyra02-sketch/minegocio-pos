import { useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// COMANDOS ESC/POS — todos como Uint8Array, sin strings Unicode
// ─────────────────────────────────────────────────────────────────────────────
const cmd = (...bytes) => new Uint8Array(bytes);

const INIT    = cmd(0x1B, 0x40);                    // Reset impresora
const BOLD_ON = cmd(0x1B, 0x45, 0x01);
const BOLD_OFF= cmd(0x1B, 0x45, 0x00);
const ALIGN_L = cmd(0x1B, 0x61, 0x00);
const ALIGN_C = cmd(0x1B, 0x61, 0x01);
const FONT_2X = cmd(0x1B, 0x21, 0x30);              // Doble alto + ancho
const FONT_1X = cmd(0x1B, 0x21, 0x00);
const LF      = cmd(0x0A);
const CUT     = cmd(0x1D, 0x56, 0x42, 0x00);        // Corte parcial
const FEED    = (n) => cmd(0x1D, 0x4A, Math.min(n, 255)); // Avance n dots

// ─────────────────────────────────────────────────────────────────────────────
// LOGO → ESC * (bit image, modo double density 8-dot)
//
// Por qué ESC * en lugar de GS v 0:
//   GS v 0 envía toda la imagen en UN bloque → satura el buffer del printer
//   (4KB típico en IT1050 y similares) → el printer entra en estado indefinido
//   y el texto posterior sale rotado o se pierde.
//
//   ESC * envía la imagen en franjas de 8px de alto, cada franja es ~106 bytes.
//   El LF al final de cada franja actúa como punto de control: el printer
//   imprime esa franja, avanza el papel, y queda listo para la siguiente.
//   Nunca supera los 128 bytes por operación GATT.
//
// Proceso de conversión:
//   1. Escalar logo respetando aspect ratio (máx 200px ancho, 120px alto)
//   2. Fondo blanco por si hay transparencia
//   3. Normalización de contraste (evita logo todo-negro o todo-blanco)
//   4. Dithering Floyd-Steinberg (mucho mejor que umbral simple para logos color)
//   5. Repack en columnas de 8px para formato ESC *
// ─────────────────────────────────────────────────────────────────────────────
const logoToStripes = (logoUrl, maxW = 200, maxH = 120) =>
    new Promise((resolve) => {
        if (!logoUrl) { resolve(null); return; }
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            try {
                // Escalar manteniendo aspect ratio dentro de maxW × maxH
                const scale = Math.min(1, maxW / img.width, maxH / img.height);
                const w = Math.floor(img.width * scale);
                const rawH = Math.floor(img.height * scale);
                // ESC * necesita altura múltiplo de 8
                const h = Math.ceil(rawH / 8) * 8;

                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, rawH);

                const { data } = ctx.getImageData(0, 0, w, h);

                // 1. RGB → escala de grises (luminance)
                const gray = new Float32Array(w * h);
                for (let i = 0; i < w * h; i++) {
                    const r = data[i*4], g = data[i*4+1], b = data[i*4+2];
                    gray[i] = r * 0.299 + g * 0.587 + b * 0.114;
                }

                // 2. Stretch de contraste: lleva el rango real al rango 0-255
                //    Evita que logos con fondo claro (200-250) queden todos blancos
                //    y logos con fondo oscuro (0-50) queden todos negros.
                let mn = 255, mx = 0;
                for (const v of gray) { if (v < mn) mn = v; if (v > mx) mx = v; }
                const range = mx - mn || 1;
                for (let i = 0; i < gray.length; i++) {
                    gray[i] = ((gray[i] - mn) / range) * 255;
                }

                // 3. Floyd-Steinberg dithering
                //    Difunde el error de cuantización a píxeles vecinos → texto y
                //    bordes nítidos, gradientes representados con tramas.
                const g = Float32Array.from(gray);
                const pixels = new Uint8Array(w * h); // 1 = impreso, 0 = blanco

                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const idx = y * w + x;
                        const old = Math.min(255, Math.max(0, g[idx]));
                        const neo = old < 128 ? 0 : 255;
                        const err = old - neo;
                        pixels[idx] = neo === 0 ? 1 : 0;
                        if (x+1 < w)         g[idx+1]   += err * 7/16;
                        if (y+1 < h) {
                            if (x > 0)       g[idx+w-1] += err * 3/16;
                                             g[idx+w]   += err * 5/16;
                            if (x+1 < w)     g[idx+w+1] += err * 1/16;
                        }
                    }
                }

                // 4. Empaquetar en franjas ESC * (8px de alto por franja)
                //    Formato de franja: ESC * 1 nL nH [col_0...col_w] LF
                //    Cada byte de columna: bit7 = pixel superior, bit0 = inferior
                const numStripes = h / 8;
                const stripes = [];

                for (let s = 0; s < numStripes; s++) {
                    const yBase = s * 8;
                    // header(5) + columns(w) + LF(1)
                    const stripe = new Uint8Array(6 + w);
                    stripe[0] = 0x1B; // ESC
                    stripe[1] = 0x2A; // *
                    stripe[2] = 0x01; // double density 8-dot
                    stripe[3] = w & 0xFF;
                    stripe[4] = (w >> 8) & 0xFF;

                    for (let x = 0; x < w; x++) {
                        let byte = 0;
                        for (let b = 0; b < 8; b++) {
                            const y = yBase + b;
                            if (y < h && pixels[y * w + x]) {
                                byte |= (0x80 >> b); // bit7 = fila 0 (arriba)
                            }
                        }
                        stripe[5 + x] = byte;
                    }
                    stripe[5 + w] = 0x0A; // LF — imprime la franja y avanza papel
                    stripes.push(stripe);
                }

                resolve(stripes);
            } catch (e) {
                console.warn('[usePrinter] logoToStripes error:', e.message);
                resolve(null);
            }
        };

        img.onerror = () => resolve(null);
        img.src = logoUrl;
    });

// ─────────────────────────────────────────────────────────────────────────────
// HOOK PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export const usePrinter = (onNotify = () => {}) => {
    const [isPrinting,   setIsPrinting]   = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [printerDevice, setPrinterDevice] = useState(null);

    // ── Helpers de texto ────────────────────────────────────────────────────
    const CHARS = 32;                           // 57mm = 32 chars/línea
    const enc = new TextEncoder();
    const t = (s) => enc.encode(s);            // string → Uint8Array (ASCII)

    const padRight = (left, right) => {
        const sp = CHARS - left.length - right.length;
        if (sp < 1) return left + '\n' + ' '.repeat(CHARS - right.length) + right;
        return left + ' '.repeat(sp) + right;
    };

    const wrap = (text, max = CHARS) => {
        if (text.length <= max) return [text];
        const lines = []; let rem = text;
        while (rem.length > max) {
            let cut = rem.lastIndexOf(' ', max);
            if (cut < 1) cut = max;
            lines.push(rem.slice(0, cut).trimEnd());
            rem = rem.slice(cut).trimStart();
        }
        if (rem) lines.push(rem);
        return lines;
    };

    const center = (s, w = CHARS) =>
        s.length >= w ? s : ' '.repeat(Math.floor((w - s.length) / 2)) + s;

    // Solo ASCII — ningún byte multi-byte en el stream ESC/POS
    const SEP  = '='.repeat(CHARS);
    const SEP2 = '-'.repeat(CHARS);

    // ── Construcción del ticket ─────────────────────────────────────────────
    // Devuelve { logo: Uint8Array|null, receipt: Uint8Array }
    // separados para poder agregar delay entre logo y texto en el envío.
    const buildTicket = async (transaction, storeProfile) => {
        const storeName = (storeProfile?.name || 'Mi Negocio').toUpperCase();
        const date = transaction.date?.seconds
            ? new Date(transaction.date.seconds * 1000).toLocaleString('es-AR', {
                day:    '2-digit', month:  '2-digit', year:   'numeric',
                hour:   '2-digit', minute: '2-digit',
              })
            : new Date().toLocaleString('es-AR');

        // -- Logo --
        let logoBuffer = null;
        if (storeProfile?.logoUrl) {
            const stripes = await logoToStripes(storeProfile.logoUrl, 200, 120);
            if (stripes?.length) {
                // Concatenar: ALIGN_C + todas las franjas
                const totalLen = ALIGN_C.length + stripes.reduce((s, p) => s + p.length, 0) + LF.length;
                logoBuffer = new Uint8Array(totalLen);
                let off = 0;
                logoBuffer.set(ALIGN_C, off); off += ALIGN_C.length;
                for (const stripe of stripes) { logoBuffer.set(stripe, off); off += stripe.length; }
                logoBuffer.set(LF, off);
            }
        }

        // -- Cuerpo del ticket --
        const parts = [];
        const add    = (...cs) => cs.forEach(c => parts.push(c));
        const addTxt = (s) => parts.push(t(s));

        add(INIT);

        // Nombre tienda (doble tamaño)
        add(ALIGN_C, FONT_2X, BOLD_ON);
        wrap(storeName, 16).forEach(line => addTxt(line + '\n'));
        add(BOLD_OFF, FONT_1X);
        addTxt('\n');

        // Meta
        add(ALIGN_L);
        addTxt(SEP + '\n');
        addTxt('Fecha:   ' + date + '\n');
        addTxt('Ticket:  #' + (transaction.id?.slice(0, 8) || 'N/A').toUpperCase() + '\n');
        const cn = transaction.clientName;
        if (cn && cn !== 'Anonimo' && cn !== 'An\u00f3nimo') {
            addTxt('Cliente: ' + cn + '\n');
        }
        if (transaction.clientInfo?.address) {
            addTxt('Dir:     ' + transaction.clientInfo.address + '\n');
        }
        addTxt(SEP + '\n');

        // Encabezado tabla
        add(BOLD_ON);
        addTxt(padRight('PRODUCTO', 'TOTAL') + '\n');
        add(BOLD_OFF);
        addTxt(SEP2 + '\n');

        // Ítems
        const items = transaction.items ?? [];
        items.forEach((item, idx) => {
            const qty   = Number(item.qty || item.quantity || 1);
            const price = Number(item.price ?? 0);
            const total = price * qty;
            const tStr  = '$' + total.toLocaleString('es-AR');
            const uStr  = '$' + price.toLocaleString('es-AR');
            const lines = wrap(item.name ?? 'Producto');
            addTxt(padRight(lines[0], tStr) + '\n');
            lines.slice(1).forEach(l => addTxt('  ' + l + '\n'));
            if (qty > 1) addTxt('  ' + qty + ' x ' + uStr + '\n');
            if (idx < items.length - 1) addTxt(SEP2 + '\n');
        });

        // Total
        addTxt(SEP + '\n');
        add(ALIGN_C, BOLD_ON);
        addTxt('TOTAL\n');
        add(FONT_2X);
        addTxt('$' + (transaction.total ?? 0).toLocaleString('es-AR') + '\n');
        add(FONT_1X, BOLD_OFF, ALIGN_L);
        addTxt(SEP + '\n');

        // Método / estado de pago
        const metodos = { cash:'Efectivo', transfer:'Transferencia', card:'Tarjeta', digital:'Digital' };
        const met = transaction.paymentMethod;
        if (met && met !== 'unspecified') {
            addTxt(center('[ ' + (metodos[met] || met) + ' ]') + '\n');
        }
        if (transaction.paymentStatus === 'pending') {
            add(BOLD_ON);
            addTxt(center('*** PENDIENTE DE PAGO ***') + '\n');
            add(BOLD_OFF);
        } else if (transaction.paymentStatus === 'partial') {
            const paid = transaction.amountPaid ?? 0;
            const saldo = (transaction.total ?? 0) - paid;
            addTxt(center('Abonado: $' + paid.toLocaleString('es-AR')) + '\n');
            add(BOLD_ON);
            addTxt(center('Saldo:   $' + saldo.toLocaleString('es-AR')) + '\n');
            add(BOLD_OFF);
        }

        // Pie
        addTxt('\n');
        add(ALIGN_C);
        addTxt(SEP2 + '\n');
        addTxt('Gracias por su compra!\n');
        addTxt(storeName + '\n');
        addTxt(SEP2 + '\n');

        // Feed + corte
        addTxt('\n\n\n');
        add(FEED(250), CUT);

        // Consolidar cuerpo
        const totalLen = parts.reduce((s, p) => s + p.length, 0);
        const receipt = new Uint8Array(totalLen);
        let off = 0;
        for (const p of parts) { receipt.set(p, off); off += p.length; }

        return { logo: logoBuffer, receipt };
    };

    // ── Envío GATT ──────────────────────────────────────────────────────────
    // Chunks de 128 bytes con 50ms de pausa entre cada uno.
    // 50ms × n_chunks da al buffer del printer (4KB) tiempo de vaciarse.
    // pauseAfterMs: pausa adicional al terminar el buffer (usado entre logo y texto).
    const sendBuffer = async (device, data, pauseAfterMs = 0) => {
        const chunkSize = 128;
        for (let i = 0; i < data.length; i += chunkSize) {
            await device.characteristic.writeValue(data.slice(i, i + chunkSize));
            await new Promise(r => setTimeout(r, 50));
        }
        if (pauseAfterMs > 0) {
            await new Promise(r => setTimeout(r, pauseAfterMs));
        }
    };

    // ── Conectar a dispositivo BT ───────────────────────────────────────────
    const doConnect = async () => {
        const device = await navigator.bluetooth.requestDevice({
            filters:          [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
            optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'],
        });
        const server   = await device.gatt.connect();
        const service  = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
        const char     = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
        return { device, characteristic: char };
    };

    const handleBtError = (error) => {
        if (error.name === 'NotFoundError')    return; // cancelado por el usuario
        if (error.name === 'NotSupportedError') { onNotify('Bluetooth no disponible en este dispositivo.'); return; }
        if (error.name === 'SecurityError')     { onNotify('Permiso de Bluetooth denegado.'); return; }
        console.error('[usePrinter]', error.name, error.message);
        onNotify('No se pudo conectar. Verifica que la impresora este encendida y cerca.');
    };

    // ── printTicket ─────────────────────────────────────────────────────────
    const printTicket = async (transaction, storeProfile) => {
        if (!('bluetooth' in navigator)) {
            onNotify('Tu navegador no soporta Bluetooth. Usa Chrome en Android.');
            return;
        }
        setIsPrinting(true);
        try {
            const { logo, receipt } = await buildTicket(transaction, storeProfile);

            let device = printerDevice;
            if (!device) {
                setIsConnecting(true);
                device = await doConnect();
                setPrinterDevice(device);
                setIsConnecting(false);
                onNotify('Conectado a ' + device.device.name);
            }

            // Enviar logo primero con 400ms de pausa posterior.
            // La pausa da tiempo al printer de procesar el bitmap y estabilizarse
            // antes de recibir el texto — evita la corrupción de estado que
            // provocaba texto rotado / desaparecido en versiones anteriores.
            if (logo) {
                await sendBuffer(device, logo, 400);
            }
            await sendBuffer(device, receipt);

        } catch (error) {
            setIsConnecting(false);
            handleBtError(error);
        } finally {
            setIsPrinting(false);
        }
    };

    // ── connectBluetooth ────────────────────────────────────────────────────
    const connectBluetooth = async () => {
        if (!('bluetooth' in navigator)) {
            onNotify('Tu navegador no soporta Bluetooth. Usa Chrome en Android.');
            return;
        }
        setIsConnecting(true);
        try {
            const device = await doConnect();
            setPrinterDevice(device);
            onNotify('Impresora conectada: ' + device.device.name);
        } catch (error) {
            handleBtError(error);
        } finally {
            setIsConnecting(false);
        }
    };

    // ── disconnectBluetooth ─────────────────────────────────────────────────
    const disconnectBluetooth = () => {
        if (printerDevice?.device?.gatt?.connected) {
            printerDevice.device.gatt.disconnect();
        }
        setPrinterDevice(null);
        onNotify('Impresora desconectada.');
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
