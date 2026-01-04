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

export const usePrinter = () => {
    const [isPrinting, setIsPrinting] = useState(false);
    const [printerDevice, setPrinterDevice] = useState(null);

    // --- 1. CONEXIÓN WEB BLUETOOTH ---
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
            alert("No se pudo conectar.");
        }
    };

    // --- GENERADOR DE TEXTO DEL TICKET ---
    const generateReceiptText = (transaction, storeProfile) => {
        const storeName = storeProfile?.name || 'MiNegocio';
        const date = transaction.date instanceof Date
            ? transaction.date.toLocaleString()
            : new Date().toLocaleString();

        let text = INIT;
        text += ALIGN_CENTER + BOLD_ON + storeName.toUpperCase() + '\n' + BOLD_OFF;
        text += "Ticket de Venta\n";
        text += "--------------------------------\n";
        text += ALIGN_LEFT;
        text += `Fecha: ${date}\n`;
        text += `Ticket: ${transaction.id?.substring(0, 8) || 'N/A'}\n`;
        text += "--------------------------------\n";

        transaction.items.forEach(item => {
            const itemTotal = item.price * (item.qty || item.quantity);
            text += `${item.qty || item.quantity} x ${item.name.substring(0, 15)}\n`;
            text += ALIGN_RIGHT + `$${itemTotal.toLocaleString()}\n` + ALIGN_LEFT;
        });

        text += "--------------------------------\n";
        text += ALIGN_RIGHT + BOLD_ON + `TOTAL: $${transaction.total.toLocaleString()}\n` + BOLD_OFF;
        text += ALIGN_CENTER + "\nGracias por su compra!\n\n\n";
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
                printRawBT(transaction, storeProfile);
            }
        } catch (error) {
            console.error("Error en impresión:", error);
        } finally {
            setIsPrinting(false);
        }
    };

    const printRawBT = (transaction, storeProfile) => {
        const text = generateReceiptText(transaction, storeProfile);
        const base64 = btoa(text);
        window.location.href = `rawbt:base64,${base64}`;
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