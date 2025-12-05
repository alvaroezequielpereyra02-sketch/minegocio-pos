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

export const usePrinter = () => {
    const [isPrinting, setIsPrinting] = useState(false);
    const [printerDevice, setPrinterDevice] = useState(null);

    // --- 1. CONEXIÓN WEB BLUETOOTH (Experimental) ---
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
            alert("No se pudo conectar. Asegúrate de que la impresora esté encendida o prueba el método RawBT.");
        }
    };

    // --- GENERADOR DE TEXTO DEL TICKET ---
    const generateReceiptText = (transaction, storeProfile) => {
        const date = transaction.date?.seconds
            ? new Date(transaction.date.seconds * 1000).toLocaleString()
            : new Date().toLocaleString();

        // Construcción del ticket comando a comando
        let text = INIT;
        text += ALIGN_CENTER + BOLD_ON + (storeProfile.name || 'MiNegocio') + '\n' + BOLD_OFF;
        text += "Ticket de Venta\n";
        text += "--------------------------------\n";
        text += ALIGN_LEFT;
        text += `Fecha: ${date}\n`;
        text += `Cliente: ${transaction.clientName}\n`;
        text += `Metodo: ${transaction.paymentMethod === 'cash' ? 'Efectivo' : transaction.paymentMethod === 'transfer' ? 'Transferencia' : 'Otro'}\n`;
        text += "--------------------------------\n";

        transaction.items.forEach(item => {
            const total = item.price * item.qty;
            // Formato: Cant x Nombre ... Total
            text += `${item.qty} x ${item.name.substring(0, 15)}\n`;
            text += ALIGN_RIGHT + `$${total.toLocaleString()}\n` + ALIGN_LEFT;
        });

        text += "--------------------------------\n";
        text += ALIGN_RIGHT + BOLD_ON + `TOTAL: $${transaction.total.toLocaleString()}\n` + BOLD_OFF;
        text += ALIGN_CENTER + "\nGracias por su compra!\n\n\n";
        text += CUT; // Comando de corte de papel

        return text;
    };

    // --- 2. IMPRESIÓN VÍA RAWBT (Recomendado para Android) ---
    // Abre la app RawBT instalada en el celular con los datos del ticket
    const printRawBT = (transaction, storeProfile) => {
        const text = generateReceiptText(transaction, storeProfile);
        const base64 = btoa(text); // Codificar a Base64
        const url = `rawbt:base64,${base64}`;
        window.location.href = url;
    };

    // --- 3. IMPRESIÓN VÍA BLUETOOTH API (Directa) ---
    const printBluetooth = async (transaction, storeProfile) => {
        if (!printerDevice) {
            await connectBluetooth();
            return;
        }

        try {
            const text = generateReceiptText(transaction, storeProfile);
            const encoder = new TextEncoder();
            const data = encoder.encode(text);

            // Enviar en trozos pequeños para no saturar el buffer
            const chunkSize = 512;
            for (let i = 0; i < data.length; i += chunkSize) {
                const chunk = data.slice(i, i + chunkSize);
                await printerDevice.characteristic.writeValue(chunk);
            }
        } catch (e) {
            console.error(e);
            alert("Error de conexión. Reconectando...");
            setPrinterDevice(null);
        }
    };

    return {
        connectBluetooth,
        printBluetooth,
        printRawBT,
        isPrinting,
        isConnected: !!printerDevice
    };
};