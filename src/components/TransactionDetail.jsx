import React, { useState } from 'react';
import { ArrowLeft, Share2, FileText, MessageCircle, X, Phone, MapPin, ExternalLink, Edit, DollarSign } from 'lucide-react';

export default function TransactionDetail({ transaction, onClose, onPrint, onShare, onCancel, customers, onUpdate, onEditItems, userData }) {
    const [showShareOptions, setShowShareOptions] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [activeTab, setActiveTab] = useState('items');

    const isAdmin = userData?.role === 'admin';

    // Estados y lógica
    const [tempStatus, setTempStatus] = useState(transaction.paymentStatus || 'pending');
    const [tempAmountPaid, setTempAmountPaid] = useState(transaction.amountPaid || 0);
    const [tempNote, setTempNote] = useState(transaction.paymentNote || '');

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

    // --- MODAL PAGOS ---
    const PaymentModal = () => (
        <div className="fixed inset-0 z-[10000] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><DollarSign size={20} className="text-blue-600" /> Gestionar Pago</h3>
                    <button onClick={() => setShowPaymentModal(false)}><X size={20} className="text-slate-400" /></button>
                </div>
                {/* ... lógica del modal de pagos igual ... */}
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
        // CONTENEDOR PRINCIPAL: Fijo y sin scroll global
        <div className="fixed inset-0 bg-slate-100/90 backdrop-blur-sm flex justify-center items-end sm:items-center z-[9000] animate-in fade-in duration-200">

            {showPaymentModal && <PaymentModal />}

            {/* Modal Compartir */}
            {showShareOptions && (
                <div className="fixed inset-0 z-[10001] bg-black/60 flex items-end justify-center sm:items-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-sm sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom">
                        <div className="p-4 flex justify-between items-start border-b">
                            <button onClick={() => setShowShareOptions(false)}><X size={24} className="text-slate-400" /></button>
                            <h3 className="font-bold text-slate-800">COMPARTIR</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-3 p-6 bg-slate-50">
                            <button onClick={() => onPrint(transaction)} className="p-4 bg-white border rounded-xl flex flex-col items-center gap-2"><FileText size={24} className="text-red-500" /> PDF</button>
                            <button onClick={() => onShare(transaction)} className="p-4 bg-white border rounded-xl flex flex-col items-center gap-2"><MessageCircle size={24} className="text-green-500" /> WhatsApp</button>
                        </div>
                    </div>
                </div>
            )}

            {/* TARJETA ESTRUCTURAL (Flex Column) */}
            {/* h-[100dvh] fuerza que ocupe TODA la pantalla en celular, evitando barras extrañas */}
            <div className="w-full max-w-2xl bg-white sm:rounded-2xl shadow-2xl h-[100dvh] sm:h-[85vh] flex flex-col relative overflow-hidden">

                {/* 1. HEADER (No se mueve) */}
                <div className="bg-white px-4 py-3 flex items-center gap-4 border-b shrink-0 z-10">
                    <button onClick={onClose} className="p-2 bg-slate-100 rounded-full"><ArrowLeft size={24} /></button>
                    <div className="flex-1">
                        <div className="text-xs text-slate-500">Venta</div>
                        <div className="font-bold text-slate-800">#{transaction.id.slice(0, 8)}</div>
                    </div>
                    {isAdmin && <button onClick={() => onEditItems(transaction)} className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Edit size={20} /></button>}
                </div>

                {/* 2. CONTENIDO SCROLLABLE (Solo esto se mueve) */}
                <div className="flex-1 overflow-y-auto bg-white p-0">
                    {/* Resumen Precio */}
                    <div className="bg-slate-50 p-6 text-center border-b">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{displayLabel}</div>
                        <div className={`text-4xl font-black ${displayColor}`}>${displayAmount.toLocaleString()}</div>
                        {isAdmin && (
                            <button onClick={() => { setTempStatus(transaction.paymentStatus); setTempAmountPaid(transaction.amountPaid || 0); setTempNote(transaction.paymentNote || ''); setShowPaymentModal(true); }} className="mt-4 px-4 py-1 bg-white border rounded-full text-xs font-bold shadow-sm">
                                Estado: {transaction.paymentStatus === 'paid' ? '✅ Pagado' : transaction.paymentStatus === 'partial' ? '⚠️ Parcial' : '❌ Pendiente'}
                            </button>
                        )}
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b sticky top-0 bg-white z-10">
                        {['items', 'details', 'client'].map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-3 text-sm font-bold border-b-2 ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}>
                                {tab === 'items' ? 'Items' : tab === 'details' ? 'Detalles' : 'Cliente'}
                            </button>
                        ))}
                    </div>

                    {/* Info */}
                    <div className="p-4 pb-4">
                        {activeTab === 'items' && (
                            <div className="space-y-3">
                                {transaction.items.map((item, i) => (
                                    <div key={i} className="flex justify-between items-center p-2 border-b last:border-0">
                                        <div className="flex gap-3">
                                            <span className="font-bold text-blue-600 w-6">{item.qty}x</span>
                                            <span>{item.name}</span>
                                        </div>
                                        <div className="font-bold">${(item.price * item.qty).toLocaleString()}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {activeTab === 'details' && (
                            <div className="space-y-4">
                                <div className="p-3 bg-slate-50 rounded border"><span className="text-xs text-slate-400 block">Fecha</span><b>{dateObj.toLocaleDateString()}</b></div>
                                <div className="p-3 bg-slate-50 rounded border"><span className="text-xs text-slate-400 block">Pago</span><b>{transaction.paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}</b></div>
                                {transaction.paymentNote && <div className="p-3 bg-yellow-50 text-yellow-800 text-sm italic border border-yellow-200 rounded">"{transaction.paymentNote}"</div>}
                            </div>
                        )}
                        {activeTab === 'client' && (
                            <div className="space-y-4 text-center p-4">
                                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold mx-auto">{clientName.charAt(0)}</div>
                                <h3 className="text-xl font-bold">{clientName}</h3>
                                {clientData.phone && <a href={`https://wa.me/${clientData.phone}`} className="block w-full py-2 bg-green-50 text-green-600 font-bold rounded-lg border border-green-200">WhatsApp</a>}
                                {clientData.address && <a href={`https://maps.google.com/?q=${clientData.address}`} className="block w-full py-2 bg-blue-50 text-blue-600 font-bold rounded-lg border border-blue-200">Mapa</a>}
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. FOOTER (Fijo abajo, fuera del scroll) */}
                <div className="shrink-0 p-4 bg-white border-t flex gap-3 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] z-20 pb-safe">
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