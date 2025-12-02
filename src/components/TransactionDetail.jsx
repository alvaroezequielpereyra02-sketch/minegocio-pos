import React, { useState } from 'react';
import { ArrowLeft, Share2, Printer, FileText, MessageCircle, X, Receipt, Mail, Phone, MapPin, CreditCard, ExternalLink, Edit, Save, DollarSign, AlertTriangle } from 'lucide-react';

export default function TransactionDetail({ transaction, onClose, onPrint, onShare, onCancel, customers, onUpdate, onEditItems, userData }) {
    const [showShareOptions, setShowShareOptions] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [activeTab, setActiveTab] = useState('items');

    const isAdmin = userData?.role === 'admin';

    // Estados para el Modal de Pagos
    const [tempStatus, setTempStatus] = useState(transaction.paymentStatus || 'pending');
    const [tempAmountPaid, setTempAmountPaid] = useState(transaction.amountPaid || 0);
    const [tempNote, setTempNote] = useState(transaction.paymentNote || '');

    // Cálculos
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
        let finalAmountPaid = tempAmountPaid;
        if (tempStatus === 'paid') finalAmountPaid = total;
        if (tempStatus === 'pending') finalAmountPaid = 0;
        onUpdate(transaction.id, { paymentStatus: tempStatus, amountPaid: finalAmountPaid, paymentNote: tempNote });
        setShowPaymentModal(false);
    };

    // Modal interno de pagos
    const PaymentModal = () => (
        <div className="fixed inset-0 z-[10000] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><DollarSign size={20} className="text-blue-600" /> Gestionar Pago</h3>
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
                        <label className="text-xs font-bold text-orange-700 uppercase mb-1 block">Monto que YA PAGÓ el cliente:</label>
                        <div className="flex items-center gap-2 bg-white border border-orange-200 rounded-lg p-2">
                            <span className="text-slate-400 font-bold text-lg">$</span>
                            <input type="number" className="w-full outline-none text-xl font-bold text-slate-800" value={tempAmountPaid} onChange={(e) => setTempAmountPaid(Number(e.target.value))} placeholder="0" autoFocus />
                        </div>
                        <div className="text-right text-xs text-orange-600 mt-2 font-bold">Quedan debiendo: ${(total - tempAmountPaid).toLocaleString()}</div>
                    </div>
                )}
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Nota Interna</label>
                    <textarea className="w-full mt-1 p-3 border rounded-lg text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500" rows="2" placeholder="Detalles del pago..." value={tempNote} onChange={(e) => setTempNote(e.target.value)} />
                </div>
                <button onClick={handleSavePayment} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg active:scale-[0.98] transition-transform">Guardar Cambios</button>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-slate-100/90 backdrop-blur-sm flex justify-center items-end sm:items-center z-[9999] animate-in fade-in duration-200">
            {showPaymentModal && <PaymentModal />}

            {showShareOptions && (
                <div className="fixed inset-0 z-[10001] bg-black/60 flex items-end justify-center sm:items-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-sm sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom">
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

            {/* ESTRUCTURA PRINCIPAL OPTIMIZADA (Flex Column estricto) */}
            <div className="w-full max-w-2xl bg-white sm:rounded-2xl shadow-2xl h-[100dvh] sm:h-[85vh] flex flex-col relative overflow-hidden animate-in slide-in-from-bottom-10 duration-300">

                {/* 1. HEADER (Fijo arriba, no scrollea) */}
                <div className="bg-white px-4 py-3 flex items-center gap-4 border-b shrink-0 z-10 shadow-sm sm:rounded-t-2xl">
                    <button onClick={onClose} className="p-3 -ml-2 text-slate-800 hover:bg-slate-100 rounded-full transition-colors active:scale-95 shadow-sm border border-slate-100" aria-label="Volver">
                        <ArrowLeft size={28} className="text-slate-700" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <div className="text-xs text-slate-500 font-medium">Detalle de Venta</div>
                        <div className="font-bold text-slate-800 truncate text-lg">#{transaction.id.slice(0, 8).toUpperCase()}</div>
                    </div>
                    {isAdmin && (
                        <button onClick={() => onEditItems(transaction)} className="px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg flex items-center gap-1.5 font-bold text-sm shadow-sm transition-transform active:scale-95">
                            <Edit size={18} /> <span className="hidden sm:inline">Editar</span>
                        </button>
                    )}
                </div>

                {/* 2. CONTENIDO (Ocupa el espacio restante y tiene su propio scroll) */}
                <div className="flex-1 overflow-y-auto bg-white">
                    {/* Cabecera de Precio */}
                    <div className="bg-slate-50 p-8 text-center border-b relative">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{displayLabel}</div>
                        <div className={`text-5xl font-extrabold tracking-tight ${displayColor}`}>${displayAmount.toLocaleString()}</div>
                        {transaction.paymentStatus === 'partial' && (
                            <div className="mt-3 flex justify-center gap-4 text-sm font-medium">
                                <span className="text-slate-500">Total: <b>${total.toLocaleString()}</b></span>
                                <span className="text-green-600">Pagado: <b>${paid.toLocaleString()}</b></span>
                            </div>
                        )}
                        <div className="mt-6 flex justify-center">
                            {isAdmin ? (
                                <button onClick={() => { setTempStatus(transaction.paymentStatus); setTempAmountPaid(transaction.amountPaid || 0); setTempNote(transaction.paymentNote || ''); setShowPaymentModal(true); }} className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm shadow-sm transition-all border transform active:scale-95 ${transaction.paymentStatus === 'paid' ? 'bg-green-100 text-green-700 border-green-200' : transaction.paymentStatus === 'partial' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                                    {transaction.paymentStatus === 'paid' ? '✅ Pagado' : transaction.paymentStatus === 'partial' ? '⚠️ Pago Parcial' : '❌ Pendiente'} <span className="opacity-50 ml-1 text-xs">▼ Cambiar</span>
                                </button>
                            ) : (
                                <div className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm border ${transaction.paymentStatus === 'paid' ? 'bg-green-50 text-green-700 border-green-200' : transaction.paymentStatus === 'partial' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                    {transaction.paymentStatus === 'paid' ? 'PAGADO' : transaction.paymentStatus === 'partial' ? 'PAGO PARCIAL' : 'PENDIENTE DE PAGO'}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Pestañas (Sticky solo dentro del contenedor de scroll) */}
                    <div className="flex border-b sticky top-0 bg-white z-10 shadow-sm">
                        {['items', 'details', 'client'].map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 pb-3 pt-3 text-sm font-bold border-b-2 transition-colors uppercase ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                                {tab === 'items' ? 'Items' : tab === 'details' ? 'Detalles' : 'Cliente'}
                            </button>
                        ))}
                    </div>

                    {/* Listas de contenido */}
                    <div className="p-6 pb-6">
                        {activeTab === 'items' && (
                            <div className="space-y-4">
                                {transaction.items.map((item, index) => (
                                    <div key={index} className="flex gap-4 items-start p-3 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-100 transition-colors">
                                        <div className="bg-blue-50 text-blue-700 font-bold w-10 h-10 rounded-lg flex items-center justify-center shrink-0">{item.qty}</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-slate-800 leading-tight">{item.name}</div>
                                            <div className="text-xs text-slate-400 mt-1">${item.price.toLocaleString()} c/u</div>
                                        </div>
                                        <div className="text-lg font-bold text-slate-700">${(item.price * item.qty).toLocaleString()}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {activeTab === 'details' && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                        <div className="text-xs text-slate-400 mb-1">Método</div>
                                        <div className="font-bold text-slate-700">{transaction.paymentMethod === 'transfer' ? 'Transferencia' : 'Efectivo'}</div>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                        <div className="text-xs text-slate-400 mb-1">Fecha</div>
                                        <div className="font-bold text-slate-700">{dateObj.toLocaleDateString()}</div>
                                    </div>
                                </div>
                                <div><h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Nota Interna</h4><div className="p-4 bg-yellow-50 border border-yellow-100 rounded-lg text-sm text-yellow-800 italic">{transaction.paymentNote || "Sin notas registradas."}</div></div>
                            </div>
                        )}
                        {activeTab === 'client' && (
                            <div className="space-y-6">
                                <div className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                                    <div className="w-12 h-12 bg-blue-200 text-blue-700 rounded-full flex items-center justify-center text-xl font-bold">{clientName.charAt(0).toUpperCase()}</div>
                                    <div><div className="font-bold text-slate-800 text-lg">{clientName}</div><div className="text-xs text-blue-600 font-medium bg-blue-100 px-2 py-0.5 rounded-full inline-block mt-1">Cliente</div></div>
                                </div>
                                <div className="space-y-3">
                                    {clientData.phone ? (<div className="flex gap-2"><a href={`tel:${clientData.phone}`} className="flex-1 flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-400"><Phone size={18} className="text-slate-400" /><span className="font-bold text-slate-700">{clientData.phone}</span></a><a href={`https://wa.me/${clientData.phone.replace(/\D/g, '')}`} target="_blank" className="w-14 bg-green-50 border border-green-200 rounded-lg flex items-center justify-center text-green-600"><MessageCircle size={24} /></a></div>) : <div className="p-3 border border-dashed text-center text-slate-400 rounded-lg">Sin teléfono</div>}
                                    {clientData.address ? (<div className="flex gap-2"><div className="flex-1 flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg"><MapPin size={18} className="text-slate-400" /><span className="font-bold text-slate-700">{clientData.address}</span></div><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clientData.address)}`} target="_blank" className="w-14 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-center text-blue-600"><ExternalLink size={24} /></a></div>) : <div className="p-3 border border-dashed text-center text-slate-400 rounded-lg">Sin dirección</div>}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. FOOTER (Fijo abajo, fuera del scroll, siempre visible) */}
                {!showShareOptions && (
                    <div className="shrink-0 p-4 border-t bg-white flex gap-3 sm:rounded-b-2xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
                        <button onClick={() => setShowShareOptions(true)} className="flex-1 h-12 flex items-center justify-center gap-2 border-2 border-slate-200 rounded-xl text-slate-700 font-bold hover:bg-slate-50 active:bg-slate-100 transition-colors"><Share2 size={20} /> Compartir</button>
                        <button onClick={() => onCancel(transaction.id)} className="flex-1 h-12 bg-white border-2 border-red-100 text-red-600 font-bold rounded-xl hover:bg-red-50 active:bg-red-100 transition-colors">Cancelar</button>
                    </div>
                )}
            </div>
        </div>
    );
}