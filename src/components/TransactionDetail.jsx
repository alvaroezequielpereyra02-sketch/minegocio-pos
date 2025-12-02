import React, { useState } from 'react';
import { ArrowLeft, Share2, Printer, FileText, MessageCircle, X, Phone, MapPin, ExternalLink, Edit, DollarSign } from 'lucide-react';

export default function TransactionDetail({
    transaction,
    onClose,
    onPrint,
    onShare,
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

    const isAdmin = userData?.role === 'admin';

    const [tempStatus, setTempStatus] = useState(transaction?.paymentStatus || 'pending');
    const [tempAmountPaid, setTempAmountPaid] = useState(transaction?.amountPaid || 0);
    const [tempNote, setTempNote] = useState(transaction?.paymentNote || '');

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
            paymentNote: tempNote
        });
        setShowPaymentModal(false);
    };

    return (
        // WRAPPER PRINCIPAL: 'fixed inset-0' asegura que ocupe toda la pantalla sin recalcular alturas raras.
        // En móvil es fondo blanco sólido. En PC tiene fondo oscuro transparente.
        <div className="fixed inset-0 z-[10000] flex justify-center sm:items-center bg-white sm:bg-slate-900/40 sm:backdrop-blur-sm animate-in slide-in-from-bottom duration-200">

            {/* MODAL DE PAGO (Overlay) */}
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
                            <textarea className="w-full mt-1 p-3 border rounded-lg text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500" rows="2" placeholder="Detalles del pago..." value={tempNote} onChange={(e) => setTempNote(e.target.value)} />
                        </div>
                        <button onClick={handleSavePayment} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg active:scale-[0.98] transition-transform">Guardar Cambios</button>
                    </div>
                </div>
            )}

            {/* MODAL COMPARTIR (Overlay) */}
            {showShareOptions && (
                <div className="fixed inset-0 z-[11000] bg-black/60 flex items-end justify-center sm:items-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-sm rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom">
                        <div className="p-4 flex justify-between items-start border-b">
                            <button onClick={() => setShowShareOptions(false)}><X size={24} className="text-slate-400" /></button>
                            <div className="text-right"><h3 className="text-lg font-bold text-slate-800">COMPARTIR</h3></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 p-6 bg-slate-50">
                            <button onClick={() => onPrint(transaction)} className="flex flex-col items-center justify-center gap-2 p-4 bg-white border rounded-xl hover:shadow-md transition-all"><div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center"><FileText size={24} /></div><span className="font-bold text-slate-700">PDF</span></button>
                            <button onClick={() => onShare(transaction)} className="flex flex-col items-center justify-center gap-2 p-4 bg-white border rounded-xl hover:shadow-md transition-all"><div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center"><MessageCircle size={24} /></div><span className="font-bold text-slate-700">WhatsApp</span></button>
                        </div>
                    </div>
                </div>
            )}

            {/* TARJETA PRINCIPAL - ESTRUCTURA FLEXBOX SÓLIDA */}
            {/* CLAVE DEL ÉXITO: 
               1. w-full h-full: Ocupa todo el contenedor fijo (la pantalla).
               2. flex flex-col: Estructura de columna.
               3. Sin 'absolute' en el footer.
            */}
            <div className="w-full h-full sm:h-auto sm:max-h-[85vh] sm:max-w-2xl bg-white sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden relative">

                {/* 1. HEADER (Fijo arriba, no se encoge 'shrink-0') */}
                <div className="bg-white px-4 py-3 flex items-center gap-4 border-b shrink-0 z-10 shadow-sm">
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

                {/* 2. CONTENIDO SCROLLABLE (Ocupa el espacio sobrante 'flex-1') */}
                <div className="flex-1 overflow-y-auto bg-slate-50/50">
                    <div className="bg-white p-6 text-center border-b mb-2">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{displayLabel}</div>
                        <div className={`text-4xl sm:text-5xl font-extrabold tracking-tight ${displayColor} mb-4`}>${displayAmount.toLocaleString()}</div>
                        <div className="flex justify-center">
                            {isAdmin ? (
                                <button onClick={() => { setTempStatus(transaction.paymentStatus); setTempAmountPaid(transaction.amountPaid || 0); setTempNote(transaction.paymentNote || ''); setShowPaymentModal(true); }} className={`flex items-center gap-2 px-5 py-2 rounded-full font-bold text-sm shadow-sm transition-all border transform active:scale-95 ${transaction.paymentStatus === 'paid' ? 'bg-green-100 text-green-700 border-green-200' : transaction.paymentStatus === 'partial' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
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

                    <div className="flex border-b sticky top-0 bg-white z-10 shadow-sm">
                        {['items', 'details', 'client'].map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors uppercase ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                                {tab === 'items' ? 'Items' : tab === 'details' ? 'Detalles' : 'Cliente'}
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
                                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100"><div className="text-xs text-slate-400 mb-1">Método</div><div className="font-bold text-slate-700 text-sm">{transaction.paymentMethod === 'transfer' ? 'Transferencia' : 'Efectivo'}</div></div>
                                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100"><div className="text-xs text-slate-400 mb-1">Fecha</div><div className="font-bold text-slate-700 text-sm">{dateObj.toLocaleDateString()}</div></div>
                                </div>
                                <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-lg text-sm text-yellow-800 italic">{transaction.paymentNote || "Sin notas adicionales."}</div>
                            </div>
                        )}
                        {activeTab === 'client' && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                                    <div className="w-10 h-10 bg-blue-200 text-blue-700 rounded-full flex items-center justify-center font-bold">{clientName.charAt(0)}</div>
                                    <div><div className="font-bold text-slate-800">{clientName}</div><div className="text-xs text-blue-600">Cliente Registrado</div></div>
                                </div>
                                {clientData.phone && (
                                    <a href={`https://wa.me/${clientData.phone.replace(/\D/g, '')}`} target="_blank" className="flex items-center justify-center gap-2 w-full py-3 bg-green-50 text-green-700 border border-green-200 rounded-lg font-bold hover:bg-green-100 transition-colors">
                                        <MessageCircle size={18} /> WhatsApp ({clientData.phone})
                                    </a>
                                )}
                                {clientData.address ? (
                                    <div className="flex gap-2">
                                        <div className="flex-1 flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg">
                                            <MapPin size={18} className="text-slate-400" />
                                            <span className="font-bold text-slate-700 text-sm">{clientData.address}</span>
                                        </div>
                                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clientData.address)}`} target="_blank" className="w-14 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-center text-blue-600 hover:bg-blue-100"><ExternalLink size={24} /></a>
                                    </div>
                                ) : <div className="p-3 border border-dashed text-center text-slate-400 rounded-lg text-sm">Sin dirección registrada</div>}
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. FOOTER (Fijo abajo, no se encoge 'shrink-0') */}
                {/* Al usar Flexbox y quitar el 'absolute', este bloque siempre estará al final sólido */}
                {!showShareOptions && (
                    <div className="p-4 border-t bg-white flex gap-3 shrink-0 z-20 shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.05)]">
                        <button onClick={() => setShowShareOptions(true)} className="flex-1 h-12 flex items-center justify-center gap-2 border-2 border-slate-200 rounded-xl text-slate-700 font-bold hover:bg-slate-50 active:bg-slate-100">
                            <Share2 size={20} /> <span className="text-sm">Compartir</span>
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