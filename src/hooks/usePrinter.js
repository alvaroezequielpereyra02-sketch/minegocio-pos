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
const CUT     = cmd(0x1D, 0x56, 0x42, 0x00);        // Corte parcial
const FEED    = (n) => cmd(0x1D, 0x4A, Math.min(n, 255)); // Avance n dots

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
    const buildTicket = async (transaction, storeProfile) => {
        const storeName = (storeProfile?.name || 'Mi Negocio').toUpperCase();
        const date = transaction.date?.seconds
            ? new Date(transaction.date.seconds * 1000).toLocaleString('es-AR', {
                day:    '2-digit', month:  '2-digit', year:   'numeric',
                hour:   '2-digit', minute: '2-digit',
              })
            : new Date().toLocaleString('es-AR');
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

        return { receipt };
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
            const { receipt } = await buildTicket(transaction, storeProfile);

            let device = printerDevice;
            if (!device) {
                setIsConnecting(true);
                device = await doConnect();
                setPrinterDevice(device);
                setIsConnecting(false);
                onNotify('Conectado a ' + device.device.name);
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
