import React, { useState } from 'react';
import { ArrowLeft, Share2, FileText, MessageCircle, X, Phone, MapPin, ExternalLink, Edit, DollarSign } from 'lucide-react';

export default function TransactionDetail({ transaction, onClose, onPrint, onShare, onCancel, customers, onUpdate, onEditItems, userData }) {
    const [showShareOptions, setShowShareOptions] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [activeTab, setActiveTab] = useState('items');

    const isAdmin = userData?.role === 'admin';

    // Estados
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

    // Modal de Pago
    const PaymentModal = () => (
        <div className="fixed inset-0 z-[10000] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><DollarSign size={20} className="text-blue-600" /> Gestionar Pago</h3>
                    <button onClick={() => setShowPaymentModal(false)}><X size={20} className="text-slate-400" /></button>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                    <button onClick={() => setTempStatus('paid')} className={`p-2 rounded-lg text-xs font-bold border ${tempStatus === 'paid' ? 'bg-green-600 text-white' : 'bg-white'}`}>✅ PAGADO</button>
                    <button onClick={() => setTempStatus('partial')} className={`p-2 rounded-lg text-xs font-bold border ${tempStatus === 'partial' ? 'bg-orange-500 text-white' : 'bg-white'}`}>⚠️ PARCIAL</button>
                    <button onClick={() => setTempStatus('pending')} className={`p-2 rounded-lg text-xs font-bold border ${tempStatus === 'pending' ? 'bg-red-500 text-white' : 'bg-white'}`}>❌ PENDIENTE</button>
                </div>
                {tempStatus === 'partial' && (
                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                        <label className="text-xs font-bold text-orange-700 block">Pagado:</label>
                        <input type="number" className="w-full text-xl font-bold bg-transparent outline-none" value={tempAmountPaid} onChange={(e) => setTempAmountPaid(Number(e.target.value))} />
                    </div>
                )}
                <textarea className="w-full p-3 border rounded-lg bg-slate-50" placeholder="Nota..." value={tempNote} onChange={(e) => setTempNote(e.target.value)} />
                <button onClick={handleSavePayment} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl">Guardar</button>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-slate-100/90 backdrop-blur-sm z-[9000] flex justify-center items-end sm:items-center animate-in fade-in duration-200">
            {showPaymentModal && <PaymentModal />}

            {showShareOptions && (
                <div className="fixed inset-0 z-[10001] bg-black/60 flex items-end justify-center sm:items-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-sm sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom p-4">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="font-bold text-slate-800">Compartir</h3>
                            <button onClick={() => setShowShareOptions(false)}><X size={24} className="text-slate-400" /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => onPrint(transaction)} className="p-4 border rounded-xl flex flex-col items-center gap-2 hover:bg-slate-50"><FileText size={24} className="text-red-500" /> PDF</button>
                            <button onClick={() => onShare(transaction)} className="p-4 border rounded-xl flex flex-col items-center gap-2 hover:bg-slate-50"><MessageCircle size={24} className="text-green-500" /> WhatsApp</button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONTENEDOR PRINCIPAL: Usamos height: 100% y relative para posicionamiento absoluto interno */}
            <div className="bg-white w-full max-w-2xl h-full sm:h-[85vh] sm:rounded-2xl shadow-2xl relative overflow-hidden flex flex-col">

                {/* 1. HEADER FIJO (Absolute Top) */}
                <div className="absolute top-0 left-0 right-0 h-16 bg-white border-b flex items-center px-4 gap-3 z-20">
                    <button onClick={onClose} className="p-2 bg-slate-100 rounded-full"><ArrowLeft size={24} /></button>
                    <div className="flex-1">
                        <div className="text-xs text-slate-500">Detalle</div>
                        <div className="font-bold text-slate-800">#{transaction.id.slice(0, 8)}</div>
                    </div>
                    {/* Botón Editar (Solo Admin) */}
                    {isAdmin && <button onClick={() => onEditItems(transaction)} className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Edit size={20} /></button>}
                </div>

                {/* 2. CONTENIDO SCROLLABLE (Absolute Middle) */}
                {/* Dejamos 64px arriba (top-16) y 80px abajo (bottom-20) para header y footer */}
                <div className="absolute top-16 bottom-20 left-0 right-0 overflow-y-auto bg-slate-50/50">
                    <div className="bg-white p-6 text-center border-b mb-2">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{displayLabel}</div>
                        <div className={`text-4xl font-black ${displayColor}`}>${displayAmount.toLocaleString()}</div>
                        {/* Estado clickable solo para admin */}
                        {isAdmin ? (
                            <button onClick={() => { setTempStatus(transaction.paymentStatus); setTempAmountPaid(transaction.amountPaid || 0); setTempNote(transaction.paymentNote || ''); setShowPaymentModal(true); }} className="mt-4 px-3 py-1 border rounded-full text-xs font-bold bg-slate-50">
                                {transaction.paymentStatus.toUpperCase()} ✎
                            </button>
                        ) : (
                            <div className="mt-4 px-3 py-1 border rounded-full text-xs font-bold bg-slate-50 inline-block">{transaction.paymentStatus.toUpperCase()}</div>
                        )}
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b bg-white sticky top-0 z-10">
                        {['items', 'details', 'client'].map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-3 text-sm font-bold border-b-2 ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}>
                                {tab === 'items' ? 'Items' : tab === 'details' ? 'Detalles' : 'Cliente'}
                            </button>
                        ))}
                    </div>

                    <div className="p-4">
                        {activeTab === 'items' && transaction.items.map((item, i) => (
                            <div key={i} className="flex justify-between p-3 bg-white mb-2 rounded border shadow-sm">
                                <div><span className="font-bold text-blue-600 mr-2">{item.qty}x</span> {item.name}</div>
                                <div className="font-bold">${(item.price * item.qty).toLocaleString()}</div>
                            </div>
                        ))}
                        {activeTab === 'details' && (
                            <div className="bg-white p-4 rounded border shadow-sm space-y-2">
                                <div><span className="text-slate-400 text-xs">Fecha:</span> <b>{dateObj.toLocaleDateString()}</b></div>
                                <div><span className="text-slate-400 text-xs">Pago:</span> <b>{transaction.paymentMethod}</b></div>
                                {transaction.paymentNote && <div className="p-2 bg-yellow-50 text-yellow-800 text-sm mt-2 rounded">"{transaction.paymentNote}"</div>}
                            </div>
                        )}
                        {activeTab === 'client' && (
                            <div className="bg-white p-4 rounded border shadow-sm text-center">
                                <div className="text-xl font-bold mb-2">{clientName}</div>
                                {clientData.phone && <a href={`https://wa.me/${clientData.phone}`} className="block w-full py-2 bg-green-100 text-green-700 rounded mb-2 font-bold">WhatsApp</a>}
                                {clientData.address && <a href={`http://maps.google.com/?q=${clientData.address}`} className="block w-full py-2 bg-blue-100 text-blue-700 rounded font-bold">Mapa</a>}
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. FOOTER FIJO (Absolute Bottom) */}
                <div className="absolute bottom-0 left-0 right-0 h-20 bg-white border-t flex items-center px-4 gap-3 z-20">
                    <button onClick={() => setShowShareOptions(true)} className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-bold text-slate-600 flex items-center justify-center gap-2">
                        <Share2 size={18} /> Compartir
                    </button>
                    <button onClick={() => onCancel(transaction.id)} className="flex-1 py-3 bg-red-50 text-red-600 font-bold rounded-xl flex items-center justify-center gap-2 border border-red-100">
                        <X size={18} /> Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
}