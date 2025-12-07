import { useState } from 'react';

// COMANDOS ESC/POS (Lenguaje estándar de impresoras térmicas)
const ESC = '\x1B';
const GS = '\x1D';
const INIT = ESC + '@';
const CUT = GS + 'V' + '\x41' + '\x00';
const BOLD_ON = ESC + 'E' + '\x01';
const BOLD_OFF = ESC + 'E' + '\x00';
const ALIGN_CENTER = ESC + 'a' + '\x01';
const ALIGN_LEFT = ESC + 'a' + '\x00';
const ALIGN_RIGHT = ESC + 'a' + '\x02';

// --- FUNCIÓN DE SEGURIDAD ---
// Soluciona el error de "String contains characters outside of the Latin1 range"
// Esto permite imprimir productos con Ñ, tildes y emojis sin romper la app.
function utf8_to_b64(str) {
    return window.btoa(unescape(encodeURIComponent(str)));
}

export const usePrinter = () => {
    const [printerDevice, setPrinterDevice] = useState(null);

    // --- 1. CONEXIÓN WEB BLUETOOTH API (Experimental) ---
    const connectBluetooth = async () => {
        try {
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
                optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
            });

            const server = await device.gatt.connect();
            const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
            const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');

            setPrinterDevice({ device, characteristic });
            alert(`Conectado a ${device.name}`);
        } catch (error) {
            console.error(error);
            alert("No se pudo conectar directamente. Recomendamos usar la opción 'RawBT' en Android.");
        }
    };

    // --- GENERADOR DE TICKET ---
    const generateReceiptText = (transaction, storeProfile) => {
        const date = transaction.date?.seconds
            ? new Date(transaction.date.seconds * 1000).toLocaleString()
            : new Date().toLocaleString();

        // Limpiamos strings para evitar errores de impresión
        const storeName = (storeProfile.name || 'MiNegocio').substring(0, 30);
        const clientName = (transaction.clientName || 'Cliente').substring(0, 30);

        let text = INIT;
        text += ALIGN_CENTER + BOLD_ON + storeName + '\n' + BOLD_OFF;
        text += "Ticket de Venta\n";
        text += "--------------------------------\n";
        text += ALIGN_LEFT;
        text += `Fecha: ${date}\n`;
        text += `Cliente: ${clientName}\n`;
        text += `Pago: ${transaction.paymentMethod === 'cash' ? 'Efectivo' : 'Digital'}\n`;
        text += "--------------------------------\n";

        transaction.items.forEach(item => {
            const total = item.price * item.qty;
            const name = item.name.substring(0, 20); // Cortar nombres largos
            text += `${item.qty} x ${name}\n`;
            text += ALIGN_RIGHT + `$${total.toLocaleString()}\n` + ALIGN_LEFT;
        });

        text += "--------------------------------\n";
        text += ALIGN_RIGHT + BOLD_ON + `TOTAL: $${transaction.total.toLocaleString()}\n` + BOLD_OFF;
        text += ALIGN_CENTER + "\nGracias por su compra!\n\n\n";
        text += CUT;

        return text;
    };

    // --- 2. IMPRESIÓN VÍA APP RAWBT (La más fiable en Android) ---
    const printRawBT = (transaction, storeProfile) => {
        try {
            const text = generateReceiptText(transaction, storeProfile);
            const base64 = utf8_to_b64(text); // Usamos el codificador seguro
            const url = `rawbt:base64,${base64}`;
            window.location.href = url;
        } catch (e) {
            console.error("Error generando ticket RawBT:", e);
            alert("Error al generar datos de impresión. Verifica caracteres especiales.");
        }
    };

    // --- 3. IMPRESIÓN DIRECTA (Si ya está conectado) ---
    const printBluetooth = async (transaction, storeProfile) => {
        if (!printerDevice) {
            await connectBluetooth();
            return;
        }
        try {
            const text = generateReceiptText(transaction, storeProfile);
            const encoder = new TextEncoder();
            const data = encoder.encode(text);
            const chunkSize = 512;
            for (let i = 0; i < data.length; i += chunkSize) {
                const chunk = data.slice(i, i + chunkSize);
                await printerDevice.characteristic.writeValue(chunk);
            }
        } catch (e) {
            console.error(e);
            alert("Error de conexión. Intenta reconectar.");
            setPrinterDevice(null);
        }
    };

    return { connectBluetooth, printRawBT, isConnected: !!printerDevice };
};