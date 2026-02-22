import React, { useState, useEffect, useMemo } from 'react';
import {
    ArrowLeft,
    Printer,
    MessageCircle,
    X,
    MapPin,
    Edit,
    DollarSign,
    Download,
    Share2,
    Loader2,
    StickyNote,
    Truck,
    CheckCircle,
    Box
} from 'lucide-react';

// --- IMPORTS DE CONTEXTO (CORREGIDOS) ---
import { useAuthContext } from '../context/AuthContext';
import { useTransactionsContext } from '../context/TransactionsContext';
import { ConfirmModal } from './Modals';

export default function TransactionDetail({
    transaction: initialTransaction,
    onClose,
    storeProfile,
    customers = [],
    onEditItems
}) {
    // 1. CONECTAMOS LOS CONTEXTOS
    const { userData } = useAuthContext();
    const { transactions, deleteTransaction, updateTransaction } = useTransactionsContext();

    // 2. BUSCAMOS LA VERSIÓN "EN VIVO" DE LA TRANSACCIÓN
    // Esto asegura que si cambias el estado a "Pagado", se vea reflejado al instante sin recargar.
    const transaction = useMemo(() => {
        if (!initialTransaction || !initialTransaction.id) return null;
        return transactions.find(t => t.id === initialTransaction.id) || initialTransaction;
    }, [transactions, initialTransaction]);

    // Si no hay datos, no renderizamos nada
    if (!transaction) return null;

    // --- ESTADOS LOCALES ---
    const [showShareOptions, setShowShareOptions] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [activeTab, setActiveTab] = useState('items'); // 'items' | 'details'
    const [isGenerating, setIsGenerating] = useState(false);

    const isAdmin = userData?.role === 'admin';

    // Estados para el modal de pago (Edición)
    const [tempStatus, setTempStatus] = useState(transaction.paymentStatus || 'pending');
    const [tempFulfillment, setTempFulfillment] = useState(transaction.fulfillmentStatus || 'pending');
    const [tempAmountPaid, setTempAmountPaid] = useState(transaction.amountPaid || 0);
    const [tempNote, setTempNote] = useState(transaction.paymentNote || '');
    const [tempPaymentMethod, setTempPaymentMethod] = useState(transaction.paymentMethod || 'unspecified');

    // Sincronizar el formulario cada vez que la transacción cambia externamente
    useEffect(() => {
        setTempStatus(transaction.paymentStatus || 'pending');
        setTempAmountPaid(transaction.amountPaid || 0);
        setTempNote(transaction.paymentNote || '');
        setTempPaymentMethod(transaction.paymentMethod || 'unspecified');
        setTempFulfillment(transaction.fulfillmentStatus || 'pending');
    }, [transaction]);

    // --- CÁLCULOS ---
    const total = transaction.total || 0;
    const paid = transaction.amountPaid || 0;
    const debt = total - paid;

    const displayAmount = transaction.paymentStatus === 'partial' ? debt : total;
    const displayLabel = transaction.paymentStatus === 'partial' ? 'Restante por Cobrar' : 'Monto Total';
    const displayColor = transaction.paymentStatus === 'partial' ? 'text-orange-600' : 'text-slate-800';

    // Datos del Cliente
    const clientData = customers.find(c => c.id === transaction.clientId) || {};
    const clientName = transaction.clientName || clientData.name || 'Consumidor Final';
    const clientPhone = clientData.phone || '';
    const clientAddress = clientData.address || '';
    const dateObj = transaction.date?.seconds ? new Date(transaction.date.seconds * 1000) : new Date();

    // --- MANEJADORES ---

    const openPaymentModal = () => {
        // Reiniciamos los valores del modal con los datos actuales
        setTempStatus(transaction.paymentStatus || 'pending');
        setTempAmountPaid(transaction.amountPaid || 0);
        setTempNote(transaction.paymentNote || '');
        setTempPaymentMethod(transaction.paymentMethod || 'unspecified');
        setShowPaymentModal(true);
    };
    const handleSavePayment = async () => {
        if (!isAdmin) return;

        let finalAmountPaid = tempAmountPaid;
        if (tempStatus === 'paid') finalAmountPaid = total;
        if (tempStatus === 'pending') finalAmountPaid = 0;

        await updateTransaction(transaction.id, {
            paymentStatus: tempStatus,
            fulfillmentStatus: tempFulfillment, // <--- ESTA ES LA CLAVE
            amountPaid: finalAmountPaid,
            paymentNote: tempNote,
            paymentMethod: tempPaymentMethod
        });

        setShowPaymentModal(false);
    };

    const handleConfirmCancel = async () => {
        // Usamos la función del contexto para borrar (y devolver stock)
        await deleteTransaction(transaction.id);
        setShowDeleteConfirm(false);
        onClose(); // Cerramos el detalle
    };

    // --- GENERADOR DE BOLETA (ESTILOS Y HTML) ---
    // Mantenemos esto expandido para que sea fácil de leer y editar
    const getTicketElement = () => {
        const styles = {
            container: `
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                padding: 40px;
                color: #333;
                background: white;
                width: 100%;
                max-width: 800px;
                margin: auto;
            `,
            header: `
                display: flex;
                justify-content: space-between;
                align-items: start;
                margin-bottom: 40px;
                border-bottom: 2px solid #f3f4f6;
                padding-bottom: 20px;
            `,
            brand: `
                flex: 1;
            `,
            logo: `
                height: 60px;
                width: auto;
                object-fit: contain;
                margin-bottom: 10px;
            `,
            storeName: `
                font-size: 24px;
                font-weight: bold;
                color: #2563eb;
                margin: 0;
            `,
            invoiceInfo: `
                text-align: right;
                flex: 1;
            `,
            invoiceTitle: `
                font-size: 32px;
                font-weight: 200;
                color: #cbd5e1;
                margin: 0;
                text-transform: uppercase;
                letter-spacing: 2px;
            `,
            meta: `
                font-size: 12px;
                color: #64748b;
                margin-top: 5px;
                line-height: 1.5;
            `,
            clientSection: `
                background: #f8fafc;
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 30px;
                border: 1px solid #e2e8f0;
            `,
            sectionTitle: `
                font-size: 11px;
                text-transform: uppercase;
                font-weight: bold;
                color: #94a3b8;
                margin-bottom: 5px;
            `,
            clientName: `
                font-size: 16px;
                font-weight: bold;
                color: #1e293b;
                margin: 0;
            `,
            clientDetails: `
                font-size: 13px;
                color: #475569;
                margin-top: 2px;
            `,
            table: `
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 30px;
            `,
            th: `
                text-align: left;
                padding: 12px 10px;
                background: #f1f5f9;
                color: #475569;
                font-size: 11px;
                font-weight: bold;
                text-transform: uppercase;
                border-bottom: 1px solid #e2e8f0;
            `,
            td: `
                padding: 14px 10px;
                border-bottom: 1px solid #f1f5f9;
                font-size: 13px;
                color: #334155;
            `,
            tdRight: `
                text-align: right;
            `,
            totalSection: `
                display: flex;
                justify-content: flex-end;
            `,
            totalBox: `
                width: 250px;
            `,
            totalRow: `
                display: flex;
                justify-content: space-between;
                padding: 5px 0;
                font-size: 13px;
                color: #64748b;
            `,
            finalTotal: `
                display: flex;
                justify-content: space-between;
                padding: 15px 0;
                border-top: 2px solid #e2e8f0;
                border-bottom: 2px solid #e2e8f0;
                margin-top: 10px;
                font-size: 18px;
                font-weight: bold;
                color: #0f172a;
            `,
            noteSection: `
                margin-top: 30px;
                padding: 15px;
                background: #fffbeb;
                border: 1px solid #fcd34d;
                border-radius: 6px;
                font-size: 12px;
                color: #92400e;
            `,
            footer: `
                margin-top: 60px;
                text-align: center;
                font-size: 11px;
                color: #94a3b8;
                border-top: 1px solid #f1f5f9;
                padding-top: 20px;
            `
        };

        const content = `
        <div style="${styles.container}">
            <div style="${styles.header}">
                <div style="${styles.brand}">
                    ${storeProfile.logoUrl ? `<img src="${storeProfile.logoUrl}" style="${styles.logo}" crossorigin="anonymous"/>` : ''}
                    <h1 style="${styles.storeName}">${storeProfile.name}</h1>
                </div>
                <div style="${styles.invoiceInfo}">
                    <h2 style="${styles.invoiceTitle}">RECIBO</h2>
                    <div style="${styles.meta}">
                        #${transaction.id.slice(0, 8).toUpperCase()}<br/>
                        ${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            </div>

            <div style="${styles.clientSection}">
                <div style="${styles.sectionTitle}">CLIENTE</div>
                <div style="${styles.clientName}">${clientName}</div>
                ${clientPhone ? `<div style="${styles.clientDetails}">Tel: ${clientPhone}</div>` : ''}
                ${clientAddress ? `<div style="${styles.clientDetails}">${clientAddress}</div>` : ''}
                <div style="${styles.clientDetails}">Método: ${transaction.paymentMethod === 'transfer' ? 'Transferencia' : 'Efectivo'}</div>
            </div>

            <table style="${styles.table}">
                <thead>
                    <tr>
                        <th style="${styles.th} width: 10%;">CANT</th>
                        <th style="${styles.th}">DESCRIPCIÓN</th>
                        <th style="${styles.th} width: 20%; text-align: right;">PRECIO UN.</th>
                        <th style="${styles.th} width: 20%; text-align: right;">TOTAL</th>
                    </tr>
                </thead>
                <tbody>
                    ${transaction.items.map(i => `
                        <tr>
                            <td style="${styles.td}">${i.qty}</td>
                            <td style="${styles.td}">
                                <span style="font-weight: 500;">${i.name}</span>
                            </td>
                            <td style="${styles.td} ${styles.tdRight}">$${i.price.toLocaleString()}</td>
                            <td style="${styles.td} ${styles.tdRight} font-weight: bold;">$${(i.qty * i.price).toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div style="${styles.totalSection}">
                <div style="${styles.totalBox}">
                    <div style="${styles.totalRow}">
                        <span>Subtotal</span>
                        <span>$${total.toLocaleString()}</span>
                    </div>
                    ${paid < total ? `
                    <div style="${styles.totalRow}">
                        <span>Pagado</span>
                        <span style="color: #10b981;">-$${paid.toLocaleString()}</span>
                    </div>
                    <div style="${styles.totalRow}">
                        <span>Pendiente</span>
                        <span style="color: #ef4444;">$${debt.toLocaleString()}</span>
                    </div>` : ''}
                    <div style="${styles.finalTotal}">
                        <span>TOTAL</span>
                        <span>$${total.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            ${transaction.paymentNote ? `
            <div style="${styles.noteSection}">
                <strong>OBSERVACIONES:</strong><br/>
                ${transaction.paymentNote}
            </div>` : ''}

            <div style="${styles.footer}">
                <p>¡Gracias por su compra!</p>
                <p>${storeProfile.name} • Comprobante Digital</p>
            </div>
        </div>`;

        const el = document.createElement('div');
        el.innerHTML = content;
        return el;
    };

    // --- FUNCIONES DE PDF Y COMPARTIR ---

    const generatePDFBlob = async () => {
        const html2pdf = (await import('html2pdf.js')).default;
        const el = getTicketElement();
        const opt = {
            margin: 0,
            filename: `recibo-${transaction.id.slice(0, 5)}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        return await html2pdf().set(opt).from(el).output('blob');
    };

    const handleDownloadPDF = async () => {
        setIsGenerating(true);
        try {
            const blob = await generatePDFBlob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Recibo_${clientName.split(' ')[0]}_${transaction.id.slice(0, 4)}.pdf`;
            a.click();
        } catch (e) {
            console.error(e);
            alert("Error al generar PDF");
        }
        setIsGenerating(false);
    };

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

    const handleWhatsAppWithFile = async () => {
        setIsGenerating(true);
        try {
            const blob = await generatePDFBlob();
            const file = new File([blob], `Recibo_${clientName.split(' ')[0]}.pdf`, { type: 'application/pdf' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: `Comprobante ${storeProfile.name}`,
                    text: `Hola ${clientName}, adjunto tu comprobante de compra.`
                });
            } else {
                alert("⚠️ Desde la PC no se puede adjuntar automático.\n\nEl PDF se descargará. Arrástralo al chat de WhatsApp.");
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = file.name;
                a.click();
                const phone = clientData.phone || '';
                window.open(`https://wa.me/${phone}?text=Adjunto%20el%20comprobante.`, '_blank');
            }
        } catch (error) {
            console.error("Error compartiendo:", error);
            if (error.name !== 'AbortError') alert("No se pudo compartir.");
        }
        setIsGenerating(false);
    };

    return (
        <div className="fixed inset-0 z-[10000] bg-white sm:bg-slate-900/40 sm:backdrop-blur-sm flex justify-center sm:items-center animate-in fade-in duration-200">

            {/* MODAL CONFIRMACIÓN DE CANCELACIÓN */}
            {showDeleteConfirm && (
                <ConfirmModal
                    title="Cancelar Venta"
                    message={`¿Estás seguro de que quieres CANCELAR la venta #${transaction.id.slice(0, 4)}?\n\n⚠️ El stock de los productos se devolverá automáticamente al inventario.`}
                    isDanger={true}
                    confirmText="Sí, Cancelar Venta"
                    onCancel={() => setShowDeleteConfirm(false)}
                    onConfirm={handleConfirmCancel}
                />
            )}

            {/* MODAL DE PAGO */}
            {showPaymentModal && (
                <div className="fixed inset-0 z-[12000] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-4">
                        <div className="flex justify-between items-center border-b pb-3">
                            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                <DollarSign size={20} className="text-orange-500" /> Gestionar Pago
                            </h3>
                            <button onClick={() => setShowPaymentModal(false)}><X size={20} className="text-slate-400" /></button>
                        </div>
                        <div className="mt-4">
                            <label className="text-xs font-bold text-slate-500 uppercase">Estado de Entrega</label>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                <button
                                    onClick={() => setTempFulfillment('pending')}
                                    className={`p-2 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center gap-1 ${tempFulfillment === 'pending' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-200'}`}
                                >
                                    <Box size={14} /> PENDIENTE
                                </button>
                                <button
                                    onClick={() => setTempFulfillment('delivered')}
                                    className={`p-2 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center gap-1 ${tempFulfillment === 'delivered' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-600 border-slate-200'}`}
                                >
                                    <CheckCircle size={14} /> ENTREGADO
                                </button>
                            </div>
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
                            <label className="text-xs font-bold text-slate-500 uppercase">Nota / Observaciones</label>
                            <textarea className="w-full mt-1 p-3 border rounded-lg text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500" rows="2" placeholder="Ej: Entregar por la tarde..." value={tempNote} onChange={(e) => setTempNote(e.target.value)} />
                        </div>

                        <button onClick={handleSavePayment} className="w-full py-3 font-black rounded-xl shadow-lg active:scale-[0.98] transition-transform btn-accent">Guardar Cambios</button>
                    </div>
                </div>
            )}

            {/* MODAL COMPARTIR */}
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
                            {isGenerating && (
                                <div className="absolute inset-0 bg-white/80 z-10 flex flex-col items-center justify-center">
                                    <Loader2 className="animate-spin text-orange-500 mb-2" size={32} />
                                    <span className="text-xs font-bold text-slate-500">Generando PDF...</span>
                                </div>
                            )}

                            {/* WhatsApp */}
                            <button onClick={handleWhatsAppWithFile} className="w-full flex items-center p-4 bg-white border border-green-200 rounded-xl hover:bg-green-50 transition-all shadow-sm group">
                                <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
                                    <MessageCircle size={20} />
                                </div>
                                <div className="text-left">
                                    <div className="font-bold text-slate-800">Enviar WhatsApp</div>
                                    <div className="text-xs text-slate-500">Adjuntar Comprobante</div>
                                </div>
                            </button>

                            <div className="grid grid-cols-2 gap-3">
                                {/* Imprimir */}
                                <button onClick={handleBrowserPrint} className="w-full flex flex-col items-center p-4 bg-white border border-slate-200 rounded-xl hover:bg-orange-50 transition-all shadow-sm group text-center">
                                    <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform group-hover:bg-orange-100 group-hover:text-orange-500">
                                        <Printer size={20} />
                                    </div>
                                    <div className="font-bold text-slate-800 text-sm">Imprimir</div>
                                    <div className="text-[10px] text-slate-500">Wifi / A4</div>
                                </button>

                                {/* Descargar */}
                                <button onClick={handleDownloadPDF} className="w-full flex flex-col items-center p-4 bg-white border border-slate-200 rounded-xl hover:bg-orange-50 transition-all shadow-sm group text-center">
                                    <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform group-hover:bg-orange-100 group-hover:text-orange-500">
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

                {/* Header */}
                <div className="bg-white px-4 py-3 flex items-center gap-4 border-b shadow-sm h-16 shrink-0">
                    <button onClick={onClose} className="p-2 -ml-2 text-slate-800 hover:bg-slate-100 rounded-full transition-colors active:scale-95">
                        <ArrowLeft size={26} className="text-slate-700" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <div className="text-xs text-slate-500 font-medium">Detalle de Venta</div>
                        <div className="font-bold text-slate-800 truncate text-lg">#{transaction.id.slice(0, 8).toUpperCase()}</div>
                    </div>
                    {isAdmin && (
                        <button onClick={() => onEditItems(transaction)} className="p-2 bg-orange-50 text-orange-500 rounded-lg hover:bg-orange-100 transition-colors active:scale-95">
                            <Edit size={22} />
                        </button>
                    )}
                </div>

                {/* Cuerpo Scrolleable */}
                <div className="flex-1 overflow-y-auto bg-slate-50/50 pb-4">
                    <div className="bg-white p-6 text-center border-b mb-2">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{displayLabel}</div>
                        <div className={`text-4xl sm:text-5xl font-extrabold tracking-tight ${displayColor} mb-4`}>${displayAmount.toLocaleString()}</div>
                        <div className="flex justify-center gap-2">
                            <button onClick={openPaymentModal} className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs border ${transaction.paymentStatus === 'paid' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                                {transaction.paymentStatus === 'paid' ? '✅ Pago Recibido' : '❌ Pago Pendiente'}
                            </button>

                            {/* NUEVO BADGE DE ENTREGA */}
                            <button onClick={openPaymentModal} className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs border ${transaction.fulfillmentStatus === 'delivered' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                                <Truck size={14} /> {transaction.fulfillmentStatus === 'delivered' ? 'ENTREGADO' : 'POR ENTREGAR'}
                            </button>
                        </div>
                    </div>

                    <div className="flex border-b bg-white z-10 shadow-sm sticky top-0">
                        {['items', 'details'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors uppercase ${activeTab === tab ? 'border-orange-500 text-orange-500' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                            >
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
                                    <div onClick={() => isAdmin && openPaymentModal()} className={`p-3 bg-slate-50 rounded-lg border border-slate-100 ${isAdmin ? 'cursor-pointer hover:border-orange-300' : ''}`}>
                                        <div className="text-xs text-slate-400 mb-1">Método</div>
                                        <div className={`font-bold text-sm ${transaction.paymentMethod === 'unspecified' ? 'text-orange-600' : 'text-slate-700'}`}>{transaction.paymentMethod === 'transfer' ? 'Transferencia' : transaction.paymentMethod === 'cash' ? 'Efectivo' : '❓ A definir'}</div>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100"><div className="text-xs text-slate-400 mb-1">Fecha</div><div className="font-bold text-slate-700 text-sm">{dateObj.toLocaleDateString()}</div></div>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-100 rounded-xl">
                                    <div className="w-10 h-10 bg-orange-200 text-orange-700 rounded-full flex items-center justify-center font-bold">{clientName.charAt(0)}</div>
                                    <div><div className="font-bold text-slate-800">{clientName}</div><div className="text-xs text-orange-500">Cliente</div></div>
                                </div>

                                {transaction.paymentNote && (
                                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                                        <div className="text-xs font-bold text-yellow-700 mb-1 flex items-center gap-1"><StickyNote size={12} /> Observaciones:</div>
                                        <div className="text-sm text-slate-700 italic">"{transaction.paymentNote}"</div>
                                    </div>
                                )}

                                {(clientData.phone || clientData.address) && (
                                    <div className="grid grid-cols-2 gap-3 pt-2">
                                        {clientData.phone && (
                                            <a href={`https://wa.me/${clientData.phone}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 p-3 bg-green-50 text-green-700 border border-green-200 rounded-xl font-bold text-sm hover:bg-green-100 transition-colors">
                                                <MessageCircle size={18} /> WhatsApp
                                            </a>
                                        )}
                                        {clientData.address && (
                                            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clientData.address)}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 p-3 bg-orange-50 text-orange-700 border border-orange-200 rounded-xl font-bold text-sm hover:bg-orange-100 transition-colors">
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
                            <button onClick={() => setShowDeleteConfirm(true)} className="flex-1 h-12 bg-white border-2 border-red-100 text-red-600 font-bold rounded-xl hover:bg-red-50 active:bg-red-100">
                                Cancelar
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}