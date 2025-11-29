import React, { useState } from 'react';
import { ArrowLeft, Share2, Printer, FileText, Trash2, MessageCircle, X, Receipt, Mail } from 'lucide-react';

export default function TransactionDetail({ transaction, onClose, onPrint, onShare, onCancel }) {
    const [showShareOptions, setShowShareOptions] = useState(false);

    if (!transaction) return null;

    const dateObj = transaction.date?.seconds ? new Date(transaction.date.seconds * 1000) : new Date();
    const dateStr = dateObj.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    // --- VISTA DE OPCIONES DE COMPARTIR (IMAGEN 2) ---
    if (showShareOptions) {
        return (
            <div className="fixed inset-0 z-[60] bg-black/60 flex items-end justify-center sm:items-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white w-full max-w-md sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300">

                    {/* Header del Modal Compartir */}
                    <div className="p-4 flex justify-between items-start border-b">
                        <button onClick={() => setShowShareOptions(false)}><X size={24} className="text-slate-400" /></button>
                        <div className="text-right">
                            <h3 className="text-lg font-bold text-slate-800">RECIBO #{transaction.id.slice(0, 6).toUpperCase()}</h3>
                            <p className="text-xs text-slate-500">{transaction.clientName}</p>
                        </div>
                    </div>

                    {/* Resumen Rápido */}
                    <div className="p-6 bg-slate-50">
                        <div className="flex justify-between items-center mb-4">
                            <span className="font-bold text-slate-700">{transaction.items.length} items</span>
                            <span className="font-bold text-xl text-slate-900">${transaction.total.toLocaleString()}</span>
                        </div>
                        <div className="space-y-2 text-sm text-slate-600 max-h-40 overflow-y-auto">
                            {transaction.items.map((item, i) => (
                                <div key={i} className="flex justify-between border-b border-slate-200 pb-1">
                                    <span>{item.qty}x {item.name}</span>
                                    <span>${(item.price * item.qty).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Botones de Acción (Estilo Imagen 2) */}
                    <div className="grid grid-cols-4 gap-2 p-4 bg-slate-800 text-white">
                        <button onClick={() => onPrint(transaction)} className="flex flex-col items-center gap-1 p-2 hover:bg-slate-700 rounded">
                            <FileText size={24} />
                            <span className="text-[10px] font-bold">PDF</span>
                        </button>
                        <button onClick={() => alert("Función Email en desarrollo")} className="flex flex-col items-center gap-1 p-2 hover:bg-slate-700 rounded opacity-50">
                            <Mail size={24} />
                            <span className="text-[10px] font-bold">Email</span>
                        </button>
                        <button onClick={() => onPrint(transaction)} className="flex flex-col items-center gap-1 p-2 hover:bg-slate-700 rounded">
                            <Printer size={24} />
                            <span className="text-[10px] font-bold">Imprimir</span>
                        </button>
                        <button onClick={() => onShare(transaction)} className="flex flex-col items-center gap-1 p-2 hover:bg-slate-700 rounded bg-green-600">
                            <MessageCircle size={24} />
                            <span className="text-[10px] font-bold">WhatsApp</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- VISTA DETALLADA PRINCIPAL (IMAGEN 3) ---
    return (
        <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in slide-in-from-right duration-300">

            {/* Navbar Superior */}
            <div className="bg-white px-4 py-3 flex items-center gap-4 border-b shadow-sm shrink-0">
                <button onClick={onClose} className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full">
                    <ArrowLeft size={24} />
                </button>
                <div className="flex-1">
                    <div className="text-xs text-slate-500">{dateStr} • {timeStr}</div>
                    <div className="font-bold text-slate-800 truncate">{transaction.clientName}</div>
                </div>
                <div className="px-2 py-1 bg-slate-100 rounded text-xs font-bold text-slate-600 border">
                    #{transaction.id.slice(0, 5)}
                </div>
            </div>

            {/* Cuerpo Principal */}
            <div className="flex-1 overflow-y-auto p-6">

                {/* Precio Gigante */}
                <div className="mb-8 text-center">
                    <div className="text-4xl font-extrabold text-slate-800 tracking-tight">
                        ${transaction.total.toLocaleString()}
                    </div>
                    <div className="text-sm text-slate-500 mt-1 uppercase font-bold tracking-wider flex items-center justify-center gap-2">
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">{transaction.paymentMethod === 'transfer' ? 'Transferencia' : 'Efectivo'}</span>
                        {transaction.paymentStatus === 'pending' && <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded">Pendiente</span>}
                    </div>
                </div>

                {/* Pestañas (Visuales) */}
                <div className="flex border-b mb-4">
                    <div className="border-b-2 border-blue-600 pb-2 px-4 text-blue-600 font-bold text-sm">ITEMS</div>
                    <div className="pb-2 px-4 text-slate-400 font-bold text-sm">DETALLES</div>
                    <div className="pb-2 px-4 text-slate-400 font-bold text-sm">CLIENTE</div>
                </div>

                {/* Lista de Items */}
                <div className="space-y-6">
                    {transaction.items.map((item, index) => (
                        <div key={index} className="flex gap-4 items-start">
                            <div className="text-xl font-light text-slate-400 w-8 text-right">{item.qty}<span className="text-xs ml-0.5">x</span></div>
                            <div className="flex-1">
                                <div className="font-bold text-slate-800 text-lg leading-tight">{item.name}</div>
                                <div className="text-xs text-slate-400 mt-1">${item.price.toLocaleString()} c/u</div>
                            </div>
                            <div className="text-lg font-bold text-slate-700">
                                ${(item.price * item.qty).toLocaleString()}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Notas */}
                {transaction.paymentNote && (
                    <div className="mt-8 p-4 bg-yellow-50 border border-yellow-100 rounded-lg text-sm text-yellow-800 italic">
                        Nota: "{transaction.paymentNote}"
                    </div>
                )}
            </div>

            {/* Footer de Acciones (Botones Inferiores) */}
            <div className="p-4 border-t bg-white safe-area-bottom flex gap-3">
                {/* Botón "Boleta" (Abre opciones de compartir) */}
                <button
                    onClick={() => setShowShareOptions(true)}
                    className="w-14 h-14 flex items-center justify-center border-2 border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                >
                    <Receipt size={24} />
                </button>

                {/* Botón Cancelar Venta */}
                <button
                    onClick={() => onCancel(transaction.id)}
                    className="flex-1 h-14 bg-white border-2 border-red-100 text-red-600 font-bold rounded-xl text-lg hover:bg-red-50 hover:border-red-200 transition-colors shadow-sm"
                >
                    Cancelar Venta
                </button>
            </div>

        </div>
    );
}