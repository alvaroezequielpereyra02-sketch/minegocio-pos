import React, { useState, useMemo } from 'react';
import { Download, ArrowLeft, Search, Calendar, User, Clock, DollarSign, Filter } from 'lucide-react';

export default function History({ transactions, userData, handleExportCSV, historySection, setHistorySection, onSelectTransaction }) {
    const [searchTerm, setSearchTerm] = useState('');

    const groupedTransactions = useMemo(() => {
        const groups = {};
        // (Lógica de agrupación mantenida igual)
        const filtered = transactions.filter(t => {
            const matchesStatus = (t.paymentStatus || 'pending') === historySection;
            const matchesSearch = t.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.items?.some(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
            return matchesStatus && matchesSearch;
        });

        filtered.forEach(t => {
            const date = t.date?.seconds ? new Date(t.date.seconds * 1000) : new Date();
            const dateKey = date.toLocaleDateString();
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(t);
        });
        return groups;
    }, [transactions, historySection, searchTerm]);

    return (
        // 👇 CAMBIO: Padding pb-28 para evitar el sidebar
        <div className="flex flex-col h-full overflow-hidden bg-slate-50 p-4 pb-28 lg:pb-4">

            {/* Header */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-4 sticky top-0 z-10">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Clock className="text-blue-600" /> Historial
                    </h2>
                    {userData.role === 'admin' && (
                        <button onClick={handleExportCSV} className="bg-green-50 text-green-700 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 border border-green-200 hover:bg-green-100 transition-colors">
                            <Download size={16} /> Excel
                        </button>
                    )}
                </div>

                {/* Filtros */}
                <div className="flex gap-2 mb-3 bg-slate-100 p-1 rounded-lg">
                    {[{ id: 'paid', l: 'Pagados' }, { id: 'pending', l: 'Pendientes' }, { id: 'partial', l: 'Parciales' }].map(opt => (
                        <button key={opt.id} onClick={() => setHistorySection(opt.id)} className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${historySection === opt.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            {opt.l}
                        </button>
                    ))}
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                    <input className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 transition-all" placeholder="Buscar cliente o producto..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-1">
                {Object.keys(groupedTransactions).length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                        <Filter size={48} className="mx-auto mb-2 opacity-20" />
                        <p>No hay movimientos aquí.</p>
                    </div>
                )}
                {Object.entries(groupedTransactions).sort((a, b) => new Date(b[0].split('/').reverse().join('-')) - new Date(a[0].split('/').reverse().join('-'))).map(([date, items]) => (
                    <div key={date}>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">{date}</div>
                        <div className="space-y-2">
                            {items.map(t => (
                                <button key={t.id} onClick={() => onSelectTransaction(t)} className="w-full bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex items-center text-left group active:scale-[0.99]">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 font-bold text-white shrink-0 ${t.paymentStatus === 'paid' ? 'bg-green-500' : t.paymentStatus === 'partial' ? 'bg-orange-400' : 'bg-red-500'}`}>
                                        <DollarSign size={20} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <span className="font-bold text-slate-900 text-lg">${t.total.toLocaleString()}</span>
                                            <span className="text-xs text-slate-400 font-medium">{t.date?.seconds ? new Date(t.date.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                        </div>
                                        <div className="text-xs text-slate-500 truncate mb-1">{t.items.length} items: {t.items.map(i => i.name).join(', ')}</div>
                                        <div className="flex items-center gap-1 text-sm font-semibold text-slate-700"><User size={14} className="text-slate-400" /><span className="truncate">{t.clientName}</span></div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}