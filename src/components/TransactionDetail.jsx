import React, { useState } from 'react';
import { ArrowLeft, Printer, FileText, MessageCircle, X, MapPin, Edit, DollarSign, Download, Phone, Share2, Loader2 } from 'lucide-react';

export default function TransactionDetail({
    transaction,
    onClose,
    storeProfile,
    onCancel,
    customers = [],
    onUpdate,
    onEditItems,
    userData
}) {
    if (!transaction) return null;

    const [showShareOptions, setShowShareOptions] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [activeTab, setActiveTab] = useState('items');

    // Estado para mostrar carga mientras se genera el PDF
    const [isGenerating, setIsGenerating] = useState(false);

    const isAdmin = userData?.role === 'admin';

    // Estados para edición de pago
    const [tempStatus, setTempStatus] = useState(transaction?.paymentStatus || 'pending');
    const [tempAmountPaid, setTempAmountPaid] = useState(transaction?.amountPaid || 0);
    const [tempNote, setTempNote] = useState(transaction?.paymentNote || '');
    const [tempPaymentMethod, setTempPaymentMethod] = useState(transaction?.paymentMethod || 'unspecified');

    const total = transaction.total || 0;
    const paid = transaction.amountPaid || 0;
    const debt = total - paid;

    const displayAmount = transaction.paymentStatus === 'partial' ? debt : total;
    const displayLabel = transaction.paymentStatus === 'partial' ? 'Restante por Cobrar' : 'Monto Total';
    const displayColor = transaction.paymentStatus === 'partial' ? 'text-orange-600' : 'text-slate-800';

    const clientData = customers.find(c => c.id === transaction.clientId) || {};
    const clientName = transaction.clientName || clientData.name || 'Consumidor Final';
    const dateObj = transaction.date?.seconds ? new Date(transaction.date.seconds * 1000) : new Date();

    const handleSavePayment = () => {
        if (!isAdmin) return;
        let finalAmountPaid = tempAmountPaid;
        if (tempStatus === 'paid') finalAmountPaid = total;
        if (tempStatus === 'pending') finalAmountPaid = 0;

        onUpdate(transaction.id, {
            paymentStatus: tempStatus,
            amountPaid: finalAmountPaid,
            paymentNote: tempNote,
            paymentMethod: tempPaymentMethod
        });
        setShowPaymentModal(false);
    };

    const openPaymentModal = () => {
        setTempStatus(transaction.paymentStatus);
        setTempAmountPaid(transaction.amountPaid || 0);
        setTempNote(transaction.paymentNote || '');
        setTempPaymentMethod(transaction.paymentMethod || 'unspecified');
        setShowPaymentModal(true);
    };

    // --- ELEMENTO HTML DEL TICKET ---
    const getTicketElement = () => {
        const content = `<div style="font-family: sans-serif; padding: 20px; color: black; background: white; width: 300px; margin: auto;">
            <h2 style="text-align:center; margin:0;">${storeProfile.name}</h2>
            <p style="text-align:center; margin-top:5px; font-size: 12px;">Comprobante de Venta</p>
            <hr style="border-top: 1px dashed #000;"/>
            <div style="font-size: 12px; margin-bottom: 10px;">
                <strong>Fecha:</strong> ${dateObj.toLocaleString()}<br/>
                <strong>Cliente:</strong> ${clientName}<br/>
                <strong>Pago:</strong> ${transaction.paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}
            </div>
            <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 1px solid #000;">
                        <th style="text-align:left;">Cant</th>
                        <th style="text-align:left;">Item</th>
                        <th style="text-align:right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${transaction.items.map(i => `
                        <tr>
                            <td style="padding: 4px 0;">${i.qty}</td>
                            <td style="padding: 4px 0;">${i.name}</td>
                            <td style="text-align:right; padding: 4px 0;">$${(i.qty * i.price).toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <hr style="border-top: 1px dashed #000;"/>
            <h3 style="text-align:right; margin: 10px 0;">TOTAL: $${total.toLocaleString()}</h3>
            <p style="text-align:center; font-size: 10px; margin-top: 20px;">¡Gracias por su compra!</p>
        </div>`;

        const el = document.createElement('div');
        el.innerHTML = content;
        return el;
    };

    // --- FUNCIÓN UNIFICADA: GENERAR PDF ---
    // Devuelve el BLOB del PDF para ser usado por Descarga o Compartir
    const generatePDFBlob = async () => {
        const html2pdf = (await import('html2pdf.js')).default;
        const el = getTicketElement();
        const opt = {
            margin: 0,
            filename: `ticket-${transaction.id.slice(0, 5)}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: [80, 200] }
        };
        // .output('blob') devuelve el archivo en binario
        return await html2pdf().set(opt).from(el).output('blob');
    };

    // --- 1. DESCARGAR PDF ---
    const handleDownloadPDF = async () => {
        setIsGenerating(true);
        try {
            const blob = await generatePDFBlob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ticket-${transaction.id.slice(0, 5)}.pdf`;
            a.click();
        } catch (e) {
            console.error(e);
            alert("Error al generar PDF");
        }
        setIsGenerating(false);
    };

    // --- 2. IMPRIMIR (Navegador) ---
    const handleBrowserPrint = async () => {
        setIsGenerating(true);
        try {
            const blob = await generatePDFBlob();
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
        } catch (e) {
            console.error(e);
        }
        setIsGenerating(false);
    };

    // --- 3. COMPARTIR WHATSAPP (CON PDF ADJUNTO) ---
    const handleWhatsAppWithFile = async () => {
        setIsGenerating(true);
        try {
            const blob = await generatePDFBlob();

            // Creamos un archivo "File" real a partir del Blob
            const file = new File([blob], `ticket-${transaction.id.slice(0, 5)}.pdf`, { type: 'application/pdf' });

            // Verificamos si el navegador soporta compartir archivos (Casi todos los móviles modernos lo hacen)
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: `Comprobante ${storeProfile.name}`,
                    text: `Hola ${clientName}, adjunto tu comprobante de compra.`
                });
            } else {
                // FALLBACK PARA PC (Donde no existe "Compartir con app")
                // Descarga el archivo y abre WhatsApp Web para que el usuario lo arrastre.
                alert("⚠️ Desde la PC no se puede adjuntar automático.\n\n1. El PDF se descargará ahora.\n2. Se abrirá WhatsApp.\n3. Arrastra el archivo descargado al chat.");

                // Descargar
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = file.name;
                a.click();

                // Abrir WhatsApp
                const phone = clientData.phone || '';
                window.open(`https://wa.me/${phone}?text=Adjunto%20el%20comprobante.`, '_blank');
            }
        } catch (error) {
            console.error("Error compartiendo:", error);
            // Si el usuario cancela el menú de compartir, puede saltar error, lo ignoramos o mostramos alerta suave.
            if (error.name !== 'AbortError') alert("No se pudo abrir el menú de compartir.");
        }
        setIsGenerating(false);
    };

    return (
        <div className="fixed inset-0 z-[10000] bg-white sm:bg-slate-900/40 sm:backdrop-blur-sm flex justify-center sm:items-center animate-in fade-in duration-200">

            {/* --- MODAL PAGO --- */}
            {showPaymentModal && (
                <div className="fixed inset-0 z-[12000] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-4">
                        <div className="flex justify-between items-center border-b pb-3">
                            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                <DollarSign size={20} className="text-blue-600" /> Gestionar Pago
                            </h3>
                            <button onClick={() => setShowPaymentModal(false)}><X size={20} className="text-slate-400" /></button>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Método de Pago</label>
                            <select value={tempPaymentMethod} onChange={(e) => setTempPaymentMethod(e.target.value)} className="w-full p-2 border rounded-lg bg-slate-50 text-sm font-bold text-slate-700 outline-none">
                                <option value="unspecified">❓ A definir</option>
                                <option value="cash">💵 Efectivo</option>
                                <option value="transfer">🏦 Transferencia</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Estado Actual</label>
                            <div className="grid grid-cols-3 gap-2 mt-2">
                                <button onClick={() => setTempStatus('paid')} className={`p-2 rounded-lg text-xs font-bold border transition-all ${tempStatus === 'paid' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-600 border-slate-200'}`}>✅ PAGADO</button>
                                <button onClick={() => setTempStatus('partial')} className={`p-2 rounded-lg text-xs font-bold border transition-all ${tempStatus === 'partial' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-200'}`}>⚠️ PARCIAL</button>
                                <button onClick={() => setTempStatus('pending')} className={`p-2 rounded-lg text-xs font-bold border transition-all ${tempStatus === 'pending' ? 'bg-red-500 text-white border-red-500' : 'bg-white text-slate-600 border-slate-200'}`}>❌ PENDIENTE</button>
                            </div>
                        </div>
                        {tempStatus === 'partial' && (
                            <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 animate-in slide-in-from-top-2">
                                <label className="text-xs font-bold text-orange-700 uppercase mb-1 block">Monto YA PAGADO:</label>
                                <div className="flex items-center gap-2 bg-white border border-orange-200 rounded-lg p-2">
                                    <span className="text-slate-400 font-bold text-lg">$</span>
                                    <input type="number" className="w-full outline-none text-xl font-bold text-slate-800" value={tempAmountPaid} onChange={(e) => setTempAmountPaid(Number(e.target.value))} placeholder="0" autoFocus />
                                </div>
                                <div className="text-right text-xs text-orange-600 mt-2 font-bold">Restan: ${(total - tempAmountPaid).toLocaleString()}</div>
                            </div>
                        )}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Nota Interna</label>
                            <textarea className="w-full mt-1 p-3 border rounded-lg text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500" rows="2" placeholder="Detalles..." value={tempNote} onChange={(e) => setTempNote(e.target.value)} />
                        </div>
                        <button onClick={handleSavePayment} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg active:scale-[0.98] transition-transform">Guardar Cambios</button>
                    </div>
                </div>
            )}

            {/* --- MODAL COMPARTIR / IMPRIMIR --- */}
            {showShareOptions && (
                <div className="fixed inset-0 z-[11000] bg-black/60 flex items-end justify-center sm:items-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-sm rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom">
                        <div className="p-4 flex justify-between items-start border-b">
                            <button onClick={() => !isGenerating && setShowShareOptions(false)} disabled={isGenerating}>
                                <X size={24} className="text-slate-400" />
                            </button>
                            <div className="text-right"><h3 className="text-lg font-bold text-slate-800">OPCIONES</h3></div>
                        </div>

                        <div className="p-4 space-y-3 bg-slate-50 relative">
                            {/* Overlay de carga */}
                            {isGenerating && (
                                <div className="absolute inset-0 bg-white/80 z-10 flex flex-col items-center justify-center">
                                    <Loader2 className="animate-spin text-blue-600 mb-2" size={32} />
                                    <span className="text-xs font-bold text-slate-500">Generando PDF...</span>
                                </div>
                            )}

                            {/* 1. WHATSAPP CON PDF */}
                            <button onClick={handleWhatsAppWithFile} className="w-full flex items-center p-4 bg-white border border-green-200 rounded-xl hover:bg-green-50 transition-all shadow-sm group">
                                <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
                                    <MessageCircle size={20} />
                                </div>
                                <div className="text-left">
                                    <div className="font-bold text-slate-800">Enviar WhatsApp</div>
                                    <div className="text-xs text-slate-500">Adjuntar PDF de Boleta</div>
                                </div>
                            </button>

                            <div className="grid grid-cols-2 gap-3">
                                {/* 2. IMPRIMIR */}
                                <button onClick={handleBrowserPrint} className="w-full flex flex-col items-center p-4 bg-white border border-slate-200 rounded-xl hover:bg-blue-50 transition-all shadow-sm group text-center">
                                    <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform group-hover:bg-blue-100 group-hover:text-blue-600">
                                        <Printer size={20} />
                                    </div>
                                    <div className="font-bold text-slate-800 text-sm">Imprimir</div>
                                    <div className="text-[10px] text-slate-500">Wifi / Sistema</div>
                                </button>

                                {/* 3. DESCARGAR */}
                                <button onClick={handleDownloadPDF} className="w-full flex flex-col items-center p-4 bg-white border border-slate-200 rounded-xl hover:bg-blue-50 transition-all shadow-sm group text-center">
                                    <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform group-hover:bg-blue-100 group-hover:text-blue-600">
                                        <Download size={20} />
                                    </div>
                                    <div className="font-bold text-slate-800 text-sm">Guardar PDF</div>
                                    <div className="text-[10px] text-slate-500">Descargar</div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CONTENEDOR PRINCIPAL */}
            <div className="w-full h-full sm:h-auto sm:max-h-[85vh] sm:max-w-2xl bg-white sm:rounded-2xl shadow-2xl relative overflow-hidden flex flex-col">
                <div className="bg-white px-4 py-3 flex items-center gap-4 border-b shadow-sm h-16 shrink-0">
                    <button onClick={onClose} className="p-2 -ml-2 text-slate-800 hover:bg-slate-100 rounded-full transition-colors active:scale-95">
                        <ArrowLeft size={26} className="text-slate-700" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <div className="text-xs text-slate-500 font-medium">Detalle de Venta</div>
                        <div className="font-bold text-slate-800 truncate text-lg">#{transaction.id.slice(0, 8).toUpperCase()}</div>
                    </div>
                    {isAdmin && (
                        <button onClick={() => onEditItems(transaction)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors active:scale-95">
                            <Edit size={22} />
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto bg-slate-50/50 pb-4">
                    <div className="bg-white p-6 text-center border-b mb-2">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{displayLabel}</div>
                        <div className={`text-4xl sm:text-5xl font-extrabold tracking-tight ${displayColor} mb-4`}>${displayAmount.toLocaleString()}</div>
                        <div className="flex justify-center">
                            {isAdmin ? (
                                <button onClick={openPaymentModal} className={`flex items-center gap-2 px-5 py-2 rounded-full font-bold text-sm shadow-sm transition-all border transform active:scale-95 ${transaction.paymentStatus === 'paid' ? 'bg-green-100 text-green-700 border-green-200' : transaction.paymentStatus === 'partial' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                                    {transaction.paymentStatus === 'paid' ? '✅ Pagado' : transaction.paymentStatus === 'partial' ? '⚠️ Pago Parcial' : '❌ Pendiente'}
                                    <span className="opacity-50 ml-1 text-xs">▼ Cambiar</span>
                                </button>
                            ) : (
                                <div className={`px-5 py-2 rounded-full font-bold text-sm border ${transaction.paymentStatus === 'paid' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                    {transaction.paymentStatus === 'paid' ? 'PAGADO' : 'PENDIENTE'}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex border-b bg-white z-10 shadow-sm sticky top-0">
                        {['items', 'details'].map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors uppercase ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                                {tab === 'items' ? 'Items' : 'Detalles'}
                            </button>
                        ))}
                    </div>

                    <div className="p-4 bg-white min-h-[300px]">
                        {activeTab === 'items' && (
                            <div className="space-y-3">
                                {transaction.items.map((item, index) => (
                                    <div key={index} className="flex gap-3 items-start p-3 bg-slate-50 rounded-lg border border-slate-100">
                                        <div className="bg-white border border-slate-200 text-slate-700 font-bold w-9 h-9 rounded flex items-center justify-center shrink-0 text-sm">{item.qty}</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-slate-800 text-sm leading-tight">{item.name}</div>
                                            <div className="text-xs text-slate-400 mt-0.5">${item.price.toLocaleString()} un.</div>
                                        </div>
                                        <div className="font-bold text-slate-800">${(item.price * item.qty).toLocaleString()}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {activeTab === 'details' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div onClick={() => isAdmin && openPaymentModal()} className={`p-3 bg-slate-50 rounded-lg border border-slate-100 ${isAdmin ? 'cursor-pointer hover:border-blue-300' : ''}`}>
                                        <div className="text-xs text-slate-400 mb-1">Método</div>
                                        <div className={`font-bold text-sm ${transaction.paymentMethod === 'unspecified' ? 'text-orange-600' : 'text-slate-700'}`}>{transaction.paymentMethod === 'transfer' ? 'Transferencia' : transaction.paymentMethod === 'cash' ? 'Efectivo' : '❓ A definir'}</div>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100"><div className="text-xs text-slate-400 mb-1">Fecha</div><div className="font-bold text-slate-700 text-sm">{dateObj.toLocaleDateString()}</div></div>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                                    <div className="w-10 h-10 bg-blue-200 text-blue-700 rounded-full flex items-center justify-center font-bold">{clientName.charAt(0)}</div>
                                    <div><div className="font-bold text-slate-800">{clientName}</div><div className="text-xs text-blue-600">Cliente</div></div>
                                </div>

                                {/* --- ACCIONES DIRECTAS DE CONTACTO --- */}
                                {(clientData.phone || clientData.address) && (
                                    <div className="grid grid-cols-2 gap-3 pt-2">
                                        {clientData.phone && (
                                            <a href={`https://wa.me/${clientData.phone}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 p-3 bg-green-50 text-green-700 border border-green-200 rounded-xl font-bold text-sm hover:bg-green-100 transition-colors">
                                                <MessageCircle size={18} /> WhatsApp
                                            </a>
                                        )}
                                        {clientData.address && (
                                            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clientData.address)}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 p-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl font-bold text-sm hover:bg-blue-100 transition-colors">
                                                <MapPin size={18} /> Mapa
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {!showShareOptions && (
                    <div className="bg-white p-4 border-t shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.05)] flex gap-3 pb-6 sm:pb-4 shrink-0">
                        <button onClick={() => setShowShareOptions(true)} className="flex-1 h-12 flex items-center justify-center gap-2 border-2 border-slate-200 rounded-xl text-slate-700 font-bold hover:bg-slate-50 active:bg-slate-100">
                            <Share2 size={20} /> <span className="text-sm">Compartir / Imprimir</span>
                        </button>
                        {isAdmin && (
                            <button onClick={() => onCancel(transaction.id)} className="flex-1 h-12 bg-white border-2 border-red-100 text-red-600 font-bold rounded-xl hover:bg-red-50 active:bg-red-100">
                                Cancelar
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}