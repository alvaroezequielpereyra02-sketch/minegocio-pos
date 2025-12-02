import React, { useState } from 'react';
import { ArrowLeft, Share2, FileText, MessageCircle, X, Phone, MapPin, Edit, DollarSign } from 'lucide-react';

export default function TransactionDetail({ transaction, onClose, onPrint, onShare, onCancel, customers, onUpdate, onEditItems, userData }) {
    const [showShareOptions, setShowShareOptions] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [activeTab, setActiveTab] = useState('items');

    // --- CORRECCIÓN 1: FORZAR MODO ADMIN ---
    // Esto es temporal para que veas los botones. Luego lo cambiamos a la lógica real.
    // const isAdmin = userData?.role === 'admin'; 
    const isAdmin = true; // <--- FORZADO A TRUE PARA QUE VEAS LOS BOTONES

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
        <div className="fixed inset-0 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in" style={{ zIndex: 100000, backgroundColor: 'rgba(0,0,0,0.6)' }}>
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
        // --- CORRECCIÓN 2: ESTILOS EN LÍNEA PARA GANAR LA GUERRA DE Z-INDEX ---
        // position: fixed, top: 0, zIndex: 99999 asegura que tape el header y el footer de la app
        <div
            className="fixed inset-0 flex justify-center items-end sm:items-center animate-in fade-in duration-200"
            style={{
                zIndex: 99999,
                backgroundColor: '#ffffff', // Fondo blanco sólido
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0
            }}
        >

            {showPaymentModal && <PaymentModal />}

            {showShareOptions && (
                <div className="fixed inset-0 flex items-end justify-center sm:items-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in" style={{ zIndex: 100001, backgroundColor: 'rgba(0,0,0,0.6)' }}>
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

            {/* CONTENEDOR FLEXIBLE */}
            <div className="w-full max-w-2xl h-full sm:h-[85vh] sm:rounded-2xl shadow-none sm:shadow-2xl relative flex flex-col bg-white">

                {/* 1. HEADER (Fijo) */}
                <div className="h-16 bg-white border-b flex items-center px-4 gap-3 shrink-0 z-10 shadow-sm">
                    <button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><ArrowLeft size={24} /></button>
                    <div className="flex-1">
                        <div className="text-xs text-slate-500">Detalle de Venta</div>
                        <div className="font-bold text-slate-800">#{transaction.id.slice(0, 8)}</div>
                    </div>
                    {/* Botón Editar (Ahora forzado a visible) */}
                    {isAdmin && <button onClick={() => onEditItems(transaction)} className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100"><Edit size={20} /></button>}
                </div>

                {/* 2. CONTENIDO (Scroll) */}
                <div className="flex-1 overflow-y-auto bg-slate-50/50 pb-4">
                    <div className="bg-white p-6 text-center border-b mb-2">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{displayLabel}</div>
                        <div className={`text-4xl font-black ${displayColor}`}>${displayAmount.toLocaleString()}</div>

                        {isAdmin ? (
                            <button onClick={() => { setTempStatus(transaction.paymentStatus); setTempAmountPaid(transaction.amountPaid || 0); setTempNote(transaction.paymentNote || ''); setShowPaymentModal(true); }} className="mt-4 px-3 py-1 border rounded-full text-xs font-bold bg-slate-50 hover:bg-slate-100 flex items-center justify-center gap-1 mx-auto">
                                {transaction.paymentStatus.toUpperCase()} <Edit size={12} />
                            </button>
                        ) : (
                            <div className="mt-4 px-3 py-1 border rounded-full text-xs font-bold bg-slate-50 inline-block text-slate-500 cursor-default">
                                {transaction.paymentStatus === 'paid' ? 'PAGADO' : transaction.paymentStatus === 'partial' ? 'PAGO PARCIAL' : 'PENDIENTE'}
                            </div>
                        )}
                    </div>

                    <div className="flex border-b bg-white sticky top-0 z-10 shadow-sm">
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
                                <div><span className="text-slate-400 text-xs">Pago:</span> <b>{transaction.paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}</b></div>
                                {transaction.paymentNote && <div className="p-2 bg-yellow-50 text-yellow-800 text-sm mt-2 rounded">"{transaction.paymentNote}"</div>}
                            </div>
                        )}
                        {activeTab === 'client' && (
                            <div className="bg-white p-4 rounded border shadow-sm text-center">
                                <div className="text-xl font-bold mb-2">{clientName}</div>
                                {clientData.phone && <a href={`https://wa.me/${clientData.phone}`} className="block w-full py-2 bg-green-100 text-green-700 rounded mb-2 font-bold">WhatsApp</a>}
                                {clientData.address && <a href={`http://googleusercontent.com/maps.google.com/?q=${clientData.address}`} className="block w-full py-2 bg-blue-100 text-blue-700 rounded font-bold">Mapa</a>}
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. FOOTER (Fijo) */}
                <div className="h-20 bg-white border-t flex items-center px-4 gap-3 shrink-0 z-20 pb-safe-area shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                    <button onClick={() => setShowShareOptions(true)} className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-bold text-slate-600 flex items-center justify-center gap-2 active:bg-slate-50">
                        <Share2 size={18} /> Compartir
                    </button>

                    {/* Botón Cancelar */}
                    {isAdmin && (
                        <button onClick={() => onCancel(transaction.id)} className="flex-1 py-3 bg-red-50 text-red-600 font-bold rounded-xl flex items-center justify-center gap-2 border border-red-100 active:bg-red-100">
                            <X size={18} /> Cancelar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}