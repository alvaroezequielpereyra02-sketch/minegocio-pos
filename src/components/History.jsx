import React, { useState, useMemo } from 'react';
import { Download, Search, User, DollarSign, Filter, Clock } from 'lucide-react';

export default function History({ transactions, userData, handleExportCSV, historySection, setHistorySection, onSelectTransaction }) {
    const [searchTerm, setSearchTerm] = useState('');

    const groupedTransactions = useMemo(() => {
        const groups = {};
        const filtered = transactions.filter(t => {
            const matchesStatus = (t.paymentStatus || 'pending') === historySection;
            const matchesSearch = !searchTerm ||
                t.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
        <div className="flex flex-col h-full overflow-hidden bg-slate-50">

            {/* Header compacto — sin padding lateral exagerado */}
            <div className="bg-white border-b border-slate-200 px-4 pt-4 pb-0 sticky top-0 z-10 shadow-sm">

                <div className="flex justify-between items-center mb-3">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Clock size={20} className="text-blue-600" /> Historial
                    </h2>
                    {userData.role === 'admin' && (
                        <button
                            onClick={handleExportCSV}
                            className="bg-green-50 text-green-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-green-200 active:bg-green-100"
                        >
                            <Download size={14} /> Excel
                        </button>
                    )}
                </div>

                {/* Filtros pegados al borde inferior del header — sin margen extra */}
                <div className="flex border-b border-slate-200">
                    {[{ id: 'paid', l: 'Pagados' }, { id: 'pending', l: 'Pendientes' }, { id: 'partial', l: 'Parciales' }].map(opt => (
                        <button
                            key={opt.id}
                            onClick={() => setHistorySection(opt.id)}
                            className={`flex-1 py-2.5 text-sm font-bold transition-all border-b-2 -mb-px ${
                                historySection === opt.id
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            {opt.l}
                        </button>
                    ))}
                </div>
            </div>

            {/* Búsqueda — fuera del sticky para no ocupar espacio fijo */}
            <div className="px-3 py-2 bg-white border-b border-slate-100">
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                    <input
                        className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-all"
                        placeholder="Buscar cliente o producto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Lista — ocupa todo el espacio restante */}
            <div className="flex-1 overflow-y-auto pb-24 lg:pb-4">
                {Object.keys(groupedTransactions).length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                        <Filter size={48} className="opacity-20" />
                        <p className="text-sm">No hay movimientos aquí.</p>
                    </div>
                ) : (
                    Object.entries(groupedTransactions)
                        .sort((a, b) => new Date(b[0].split('/').reverse().join('-')) - new Date(a[0].split('/').reverse().join('-')))
                        .map(([date, items]) => (
                            <div key={date}>
                                {/* Separador de fecha — compacto */}
                                <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50 sticky top-0">
                                    {date}
                                </div>

                                {/* Cards sin gap entre ellos — separados por borde */}
                                <div className="divide-y divide-slate-100">
                                    {items.map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => onSelectTransaction(t)}
                                            className="w-full bg-white px-4 py-4 flex items-center text-left active:bg-slate-50 transition-colors"
                                        >
                                            {/* Ícono más grande */}
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 font-bold text-white shrink-0 ${
                                                t.paymentStatus === 'paid' ? 'bg-green-500' :
                                                t.paymentStatus === 'partial' ? 'bg-orange-400' : 'bg-red-500'
                                            }`}>
                                                <DollarSign size={22} />
                                            </div>

                                            {/* Contenido — usa todo el ancho */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-baseline mb-0.5">
                                                    <span className="font-black text-slate-900 text-xl">${t.total.toLocaleString()}</span>
                                                    <span className="text-xs text-slate-400 font-medium ml-2 shrink-0">
                                                        {t.date?.seconds ? new Date(t.date.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                    </span>
                                                </div>
                                                <div className="text-sm font-semibold text-slate-700 flex items-center gap-1 mb-0.5">
                                                    <User size={13} className="text-slate-400 shrink-0" />
                                                    <span className="truncate">{t.clientName}</span>
                                                </div>
                                                <div className="text-xs text-slate-400 truncate">
                                                    {t.items?.length} items: {t.items?.map(i => i.name).join(', ')}
                                                </div>
                                            </div>

                                            {/* Chevron sutil */}
                                            <div className="text-slate-300 ml-2 shrink-0">›</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))
                )}
            </div>
        </div>
    );
}
