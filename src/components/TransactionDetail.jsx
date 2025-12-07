import React, { useState } from 'react';
import { ArrowLeft, Printer, MessageCircle, X, MapPin, Edit, DollarSign, Bluetooth, Phone, Download, Share2, Loader2 } from 'lucide-react';

export default function TransactionDetail({
    transaction,
    onClose,
    printer,
    storeProfile,
    onCancel,
    customers = [],
    onUpdate,
    onEditItems,
    userData
}) {
    if (!transaction) return null;

    const [showOptions, setShowOptions] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [isSharing, setIsSharing] = useState(false); // Estado de carga para PDF
    const [activeTab, setActiveTab] = useState('details'); // Por defecto detalles para ver al cliente

    const isAdmin = userData?.role === 'admin';

    // Estados de pago
    const [tempStatus, setTempStatus] = useState(transaction?.paymentStatus || 'pending');
    const [tempAmountPaid, setTempAmountPaid] = useState(transaction?.amountPaid || 0);
    const [tempNote, setTempNote] = useState(transaction?.paymentNote || '');
    const [tempPaymentMethod, setTempPaymentMethod] = useState(transaction?.paymentMethod || 'unspecified');

    // Datos financieros
    const total = transaction.total || 0;
    const paid = transaction.amountPaid || 0;
    const displayAmount = transaction.paymentStatus === 'partial' ? (total - paid) : total;
    const displayLabel = transaction.paymentStatus === 'partial' ? 'Resta Cobrar' : 'Total';
    const displayColor = transaction.paymentStatus === 'partial' ? 'text-orange-600' : 'text-slate-900';

    // --- BÚSQUEDA INTELIGENTE DE CLIENTE ---
    const clientData = customers.find(c => c.id === transaction.clientId) || {};
    const clientName = transaction.clientName || clientData.name || 'Consumidor Final';
    const clientPhone = clientData.phone || '';
    const clientAddress = clientData.address || '';
    const dateObj = transaction.date?.seconds ? new Date(transaction.date.seconds * 1000) : new Date();

    // --- 1. GENERAR CONTENIDO VISUAL DEL TICKET ---
    const getTicketHTML = () => {
        return `
            <div style="font-family: monospace; padding: 20px; max-width: 300px; margin: 0 auto; background: white; color: black;">
                <h2 style="text-align: center; margin: 0;">${storeProfile.name}</h2>
                <p style="text-align: center; font-size: 12px; margin-bottom: 20px;">Comprobante #${transaction.id.slice(0, 6).toUpperCase()}</p>
                
                <div style="border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px;">
                    <div><strong>Fecha:</strong> ${dateObj.toLocaleDateString()}</div>
                    <div><strong>Cliente:</strong> ${clientName}</div>
                </div>

                <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
                    ${transaction.items.map(i => `
                        <tr>
                            <td style="padding: 2px 0;">${i.qty} x ${i.name}</td>
                            <td style="text-align: right;">$${(i.qty * i.price).toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </table>

                <div style="border-top: 1px dashed #000; margin-top: 10px; padding-top: 10px; text-align: right;">
                    <h3 style="margin: 0;">TOTAL: $${total.toLocaleString()}</h3>
                </div>
                <p style="text-align: center; font-size: 10px; margin-top: 20px;">¡Gracias por su compra!</p>
            </div>
        `;
    };

    // --- 2. COMPARTIR PDF POR WHATSAPP (Nativo) ---
    const handleSharePDF = async () => {
        setIsSharing(true);
        try {
            // Importar librería dinámicamente
            const html2pdf = (await import('html2pdf.js')).default;
            const element = document.createElement('div');
            element.innerHTML = getTicketHTML();

            // Generar Blob del PDF
            const worker = html2pdf().set({ margin: 0, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: [80, 200] } }).from(element).output('blob');
            const blob = await worker;

            // Crear archivo virtual
            const file = new File([blob], `Ticket_${clientName}.pdf`, { type: 'application/pdf' });

            // Usar API nativa de compartir (Abre menú de Android -> Elegir WhatsApp)
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'Comprobante de Venta',
                    text: `Hola ${clientName}, aquí tienes tu comprobante de ${storeProfile.name}.`
                });
            } else {
                alert("Tu navegador no soporta compartir archivos. Se descargará el PDF.");
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = file.name; a.click();
            }
        } catch (e) {
            console.error(e);
            alert("Error al generar PDF. Intenta nuevamente.");
        } finally {
            setIsSharing(false);
        }
    };

    // --- 3. IMPRIMIR DIRECTO (Diálogo de sistema) ---
    const handleSystemPrint = () => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`<html><head><title>Imprimir Ticket</title></head><body onload="window.print();window.close()">${getTicketHTML()}</body></html>`);
        printWindow.document.close();
    };

    // --- 4. DESCARGAR PDF (Solo guardar) ---
    const handleDownloadPDF = async () => {
        const html2pdf = (await import('html2pdf.js')).default;
        const element = document.createElement('div');
        element.innerHTML = getTicketHTML();
        html2pdf().set({ margin: 0, filename: `Ticket_${transaction.id.slice(0, 6)}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: [80, 200] } }).from(element).save();
    };

    // Guardar Pago
    const handleSavePayment = () => {
        if (!isAdmin) return;
        let finalAmountPaid = tempAmountPaid;
        if (tempStatus === 'paid') finalAmountPaid = total;
        if (tempStatus === 'pending') finalAmountPaid = 0;
        onUpdate(transaction.id, { paymentStatus: tempStatus, amountPaid: finalAmountPaid, paymentNote: tempNote, paymentMethod: tempPaymentMethod });
        setShowPaymentModal(false);
    };

    return (
        <div className="fixed inset-0 z-[10000] bg-white sm:bg-slate-900/40 sm:backdrop-blur-sm flex justify-center sm:items-center animate-in fade-in duration-200">

            {/* Modal de Opciones */}
            {showOptions && (
                <div className="fixed inset-0 z-[11000] bg-black/60 flex items-end justify-center sm:items-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-sm rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom">
                        <div className="p-4 flex justify-between items-center border-b bg-slate-50">
                            <h3 className="font-bold text-lg text-slate-800">Acciones</h3>
                            <button onClick={() => setShowOptions(false)}><X size={24} className="text-slate-400" /></button>
                        </div>
                        <div className="p-4 space-y-3">
                            <button onClick={handleSharePDF} disabled={isSharing} className="w-full flex items-center p-4 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-all">
                                <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center mr-3">
                                    {isSharing ? <Loader2 className="animate-spin" /> : <MessageCircle size={20} />}
                                </div>
                                <div className="text-left"><div className="font-bold text-green-900">Enviar por WhatsApp</div><div className="text-xs text-green-700">Compartir PDF adjunto</div></div>
                            </button>

                            <button onClick={() => printer.printRawBT(transaction, storeProfile)} className="w-full flex items-center p-4 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-all">
                                <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center mr-3"><Bluetooth size={20} /></div>
                                <div className="text-left"><div className="font-bold text-blue-900">Impresora Bluetooth</div><div className="text-xs text-blue-700">App RawBT (Térmica)</div></div>
                            </button>

                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={handleSystemPrint} className="flex flex-col items-center justify-center p-4 bg-white border rounded-xl hover:bg-slate-50"><Printer size={24} className="mb-2 text-slate-600" /><span className="text-xs font-bold text-slate-700">Imprimir (Wifi)</span></button>
                                <button onClick={handleDownloadPDF} className="flex flex-col items-center justify-center p-4 bg-white border rounded-xl hover:bg-slate-50"><Download size={24} className="mb-2 text-slate-600" /><span className="text-xs font-bold text-slate-700">Guardar PDF</span></button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Pago (Simplificado para brevedad, misma lógica) */}
            {showPaymentModal && (
                <div className="fixed inset-0 z-[12000] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-4">
                        <div className="flex justify-between items-center"><h3 className="font-bold text-lg">Gestionar Pago</h3><button onClick={() => setShowPaymentModal(false)}><X size={20} /></button></div>
                        <select value={tempPaymentMethod} onChange={e => setTempPaymentMethod(e.target.value)} className="w-full p-2 border rounded font-bold"><option value="cash">Efectivo</option><option value="transfer">Transferencia</option><option value="unspecified">A definir</option></select>
                        <div className="grid grid-cols-3 gap-2"><button onClick={() => setTempStatus('paid')} className={`p-2 rounded font-bold border ${tempStatus === 'paid' ? 'bg-green-600 text-white' : ''}`}>PAGADO</button><button onClick={() => setTempStatus('pending')} className={`p-2 rounded font-bold border ${tempStatus === 'pending' ? 'bg-red-500 text-white' : ''}`}>PENDIENTE</button><button onClick={() => setTempStatus('partial')} className={`p-2 rounded font-bold border ${tempStatus === 'partial' ? 'bg-orange-500 text-white' : ''}`}>PARCIAL</button></div>
                        {tempStatus === 'partial' && <input type="number" value={tempAmountPaid} onChange={e => setTempAmountPaid(Number(e.target.value))} className="w-full p-2 border rounded font-bold text-xl" />}
                        <button onClick={handleSavePayment} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl">Guardar</button>
                    </div>
                </div>
            )}

            {/* VISTA PRINCIPAL */}
            <div className="w-full h-full sm:h-auto sm:max-h-[85vh] sm:max-w-2xl bg-white sm:rounded-2xl shadow-2xl relative overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-white px-4 py-3 flex items-center gap-4 border-b shadow-sm h-16 shrink-0">
                    <button onClick={onClose} className="p-2 -ml-2 text-slate-800 hover:bg-slate-100 rounded-full"><ArrowLeft size={26} /></button>
                    <div className="flex-1 min-w-0"><div className="text-xs text-slate-500 font-medium">Venta</div><div className="font-bold text-slate-800 text-lg">#{transaction.id.slice(0, 6).toUpperCase()}</div></div>
                    {isAdmin && <button onClick={() => onEditItems(transaction)} className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Edit size={22} /></button>}
                </div>

                {/* Body con Scroll */}
                <div className="flex-1 overflow-y-auto bg-slate-50 pb-20 custom-scrollbar">
                    {/* INFO CLIENTE + ACCIONES RÁPIDAS */}
                    <div className="bg-white p-4 mb-2 shadow-sm">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h2 className="text-xl font-extrabold text-slate-900">{clientName}</h2>
                                <div className="text-sm text-slate-500 flex items-center gap-1 mt-1"><MapPin size={14} /> {clientAddress || 'Sin dirección registrada'}</div>
                            </div>
                            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-600">{clientName.charAt(0)}</div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <a href={clientPhone ? `tel:${clientPhone}` : '#'} className={`flex flex-col items-center justify-center p-2 rounded-lg bg-blue-50 text-blue-700 ${!clientPhone && 'opacity-50 grayscale'}`}>
                                <Phone size={20} className="mb-1" /><span className="text-[10px] font-bold">Llamar</span>
                            </a>
                            <a href={clientPhone ? `https://wa.me/${clientPhone.replace(/\D/g, '')}` : '#'} target="_blank" className={`flex flex-col items-center justify-center p-2 rounded-lg bg-green-50 text-green-700 ${!clientPhone && 'opacity-50 grayscale'}`}>
                                <MessageCircle size={20} className="mb-1" /><span className="text-[10px] font-bold">WhatsApp</span>
                            </a>
                            <a href={clientAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clientAddress)}` : '#'} target="_blank" className={`flex flex-col items-center justify-center p-2 rounded-lg bg-orange-50 text-orange-700 ${!clientAddress && 'opacity-50 grayscale'}`}>
                                <MapPin size={20} className="mb-1" /><span className="text-[10px] font-bold">Mapa</span>
                            </a>
                        </div>
                    </div>

                    {/* ESTADO PAGO */}
                    <div className="bg-white p-6 text-center mb-2 shadow-sm" onClick={() => isAdmin && setShowPaymentModal(true)}>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{displayLabel}</div>
                        <div className={`text-4xl font-black ${displayColor} mb-2`}>${displayAmount.toLocaleString()}</div>
                        <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${transaction.paymentStatus === 'paid' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-100'}`}>
                            {transaction.paymentStatus === 'paid' ? '✅ Pagado' : transaction.paymentStatus === 'partial' ? '⚠️ Parcial' : '❌ Pendiente'}
                            {isAdmin && <span>▼</span>}
                        </div>
                    </div>

                    {/* ITEMS */}
                    <div className="bg-white p-4 shadow-sm min-h-[200px]">
                        <h3 className="font-bold text-slate-800 mb-3 text-sm border-b pb-2">Detalle de Compra</h3>
                        <div className="space-y-3">
                            {transaction.items.map((item, i) => (
                                <div key={i} className="flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="font-bold text-slate-500 w-6">{item.qty}x</div>
                                        <div className="font-medium text-slate-800">{item.name}</div>
                                    </div>
                                    <div className="font-bold text-slate-900">${(item.price * item.qty).toLocaleString()}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* FOOTER ACCIONES */}
                <div className="bg-white p-4 border-t absolute bottom-0 left-0 right-0">
                    <button onClick={() => setShowOptions(true)} className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform">
                        <Share2 size={20} /> Opciones de Ticket
                    </button>
                </div>
            </div>
        </div>
    );
}