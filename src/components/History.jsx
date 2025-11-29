import React from 'react';
import { Download, CheckCircle, AlertCircle, Clock, ArrowLeft, Edit, Printer, MessageCircle } from 'lucide-react';

export default function History({
    transactions,
    userData,
    handleExportCSV,
    historySection,
    setHistorySection,
    onEditTransaction,
    onPrintTicket,
    onShareWhatsApp
}) {
    return (
        <div className="flex flex-col h-full overflow-hidden pb-20 lg:pb-0">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
                <h2 className="text-xl font-bold">Historial</h2>
                {userData.role === 'admin' && (
                    <button onClick={handleExportCSV} className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm flex gap-2">
                        <Download size={16} /> Excel
                    </button>
                )}
            </div>

            {historySection === 'menu' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 overflow-y-auto">
                    <button onClick={() => setHistorySection('paid')} className="bg-green-50 border border-green-200 p-6 rounded-2xl flex flex-col items-center justify-center hover:bg-green-100 transition-all shadow-sm">
                        <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white mb-4"><CheckCircle size={32} /></div>
                        <h3 className="text-xl font-bold text-green-800">Pagados</h3>
                        <p className="text-sm text-green-600">Ventas completadas</p>
                    </button>
                    <button onClick={() => setHistorySection('pending')} className="bg-red-50 border border-red-200 p-6 rounded-2xl flex flex-col items-center justify-center hover:bg-red-100 transition-all shadow-sm">
                        <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center text-white mb-4"><AlertCircle size={32} /></div>
                        <h3 className="text-xl font-bold text-red-800">Pendientes</h3>
                        <p className="text-sm text-red-600">Ventas por cobrar</p>
                    </button>
                    <button onClick={() => setHistorySection('partial')} className="bg-orange-50 border border-orange-200 p-6 rounded-2xl flex flex-col items-center justify-center hover:bg-orange-100 transition-all shadow-sm">
                        <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center text-white mb-4"><Clock size={32} /></div>
                        <h3 className="text-xl font-bold text-orange-800">Parciales</h3>
                        <p className="text-sm text-orange-600">Pagos incompletos</p>
                    </button>
                </div>
            ) : (
                <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div className={`p-4 flex items-center gap-4 border-b ${historySection === 'paid' ? 'bg-green-50' : historySection === 'pending' ? 'bg-red-50' : 'bg-orange-50'}`}>
                        <button onClick={() => setHistorySection('menu')} className="p-2 bg-white rounded-full shadow-sm hover:scale-105 transition-transform"><ArrowLeft size={20} /></button>
                        <h3 className="text-lg font-bold capitalize">{historySection === 'paid' ? 'Pagados' : historySection === 'pending' ? 'Pendientes' : 'Parciales'}</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto divide-y">
                        {transactions.filter(t => (t.paymentStatus || 'pending') === historySection).map(t => (
                            <div key={t.id} className="p-4 flex justify-between items-center hover:bg-slate-50">
                                <div>
                                    <p className="font-medium">{t.clientName || 'Anónimo'} <span className="text-slate-400 font-normal ml-2">{new Date(t.date?.seconds * 1000).toLocaleTimeString()}</span></p>
                                    <p className="text-xs text-slate-500 truncate w-48 mt-1">{t.items?.map(i => `${i.qty} ${i.name}`).join(', ')}</p>
                                    {t.paymentNote && <p className="text-xs text-slate-500 italic mt-1 bg-slate-100 inline-block px-1 rounded">{t.paymentNote}</p>}
                                    <div className="mt-1 flex gap-2">{t.paymentMethod && <span className="text-[10px] bg-slate-200 px-1.5 rounded uppercase font-bold text-slate-600">{t.paymentMethod}</span>}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="font-bold text-slate-800">${t.total}</div>
                                    {userData.role === 'admin' && (
                                        <button onClick={() => onEditTransaction(t)} className="p-2 bg-slate-100 rounded-full hover:bg-blue-100 text-blue-600"><Edit size={14} /></button>
                                    )}
                                    <button onClick={() => onPrintTicket(t)} className="p-2 bg-slate-100 rounded-full hover:bg-green-100 text-green-600"><Printer size={14} /></button>
                                    <button onClick={() => onShareWhatsApp(t)} className="p-2 bg-green-50 rounded-full hover:bg-green-100 text-green-600"><MessageCircle size={14} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}