import React, { useState, useMemo } from 'react';
import { Download, ArrowLeft, Search, Calendar, User, Clock, DollarSign, Filter } from 'lucide-react';

export default function History({
    transactions,
    userData,
    handleExportCSV,
    historySection,
    setHistorySection,
    onSelectTransaction
}) {
    const [searchTerm, setSearchTerm] = useState('');

    const groupedTransactions = useMemo(() => {
        const groups = {};
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const todayStr = today.toLocaleDateString();
        const yesterdayStr = yesterday.toLocaleDateString();

        const filtered = transactions.filter(t => {
            const matchesStatus = (t.paymentStatus || 'pending') === historySection;
            const matchesSearch = t.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.items?.some(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
            return matchesStatus && matchesSearch;
        });

        filtered.forEach(t => {
            const date = t.date?.seconds ? new Date(t.date.seconds * 1000) : new Date();
            const dateKey = date.toLocaleDateString();

            let label = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
            if (dateKey === todayStr) label = "Hoy";
            else if (dateKey === yesterdayStr) label = "Ayer";

            label = label.charAt(0).toUpperCase() + label.slice(1);

            if (!groups[label]) groups[label] = { total: 0, count: 0, items: [] };

            groups[label].items.push(t);
            groups[label].total += t.total;
            groups[label].count += 1;
        });

        return groups;
    }, [transactions, historySection, searchTerm]);

    if (historySection === 'menu') {
        return (
            <div className="flex flex-col h-full overflow-hidden pb-20 lg:pb-0">
                <div className="flex justify-between items-center mb-6 flex-shrink-0">
                    <h2 className="text-xl font-bold text-slate-800">Transacciones</h2>
                    {userData.role === 'admin' && (
                        <button onClick={handleExportCSV} className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm flex gap-2 font-bold shadow-sm active:scale-95 transition-transform">
                            <Download size={16} /> Excel
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-4 flex-1 overflow-y-auto">
                    <button onClick={() => setHistorySection('paid')} className="bg-white border-l-4 border-green-500 p-6 rounded-xl shadow-sm hover:shadow-md transition-all text-left group">
                        <h3 className="text-lg font-bold text-slate-800 group-hover:text-green-600 transition-colors">Ventas Pagadas</h3>
                        <p className="text-sm text-slate-500">Transacciones completadas con éxito</p>
                    </button>
                    <button onClick={() => setHistorySection('pending')} className="bg-white border-l-4 border-red-500 p-6 rounded-xl shadow-sm hover:shadow-md transition-all text-left group">
                        <h3 className="text-lg font-bold text-slate-800 group-hover:text-red-600 transition-colors">Pendientes de Cobro</h3>
                        <p className="text-sm text-slate-500">Cuentas corrientes y deudas</p>
                    </button>
                    <button onClick={() => setHistorySection('partial')} className="bg-white border-l-4 border-orange-500 p-6 rounded-xl shadow-sm hover:shadow-md transition-all text-left group">
                        <h3 className="text-lg font-bold text-slate-800 group-hover:text-orange-600 transition-colors">Pagos Parciales</h3>
                        <p className="text-sm text-slate-500">Abonos incompletos</p>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden pb-20 lg:pb-0 bg-slate-50 -m-4">

            <div className="bg-white p-4 sticky top-0 z-10 border-b shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                    <button onClick={() => setHistorySection('menu')} className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full">
                        <ArrowLeft size={24} />
                    </button>
                    <h3 className="text-xl font-bold capitalize text-slate-800">
                        {historySection === 'paid' ? 'Ventas' : historySection === 'pending' ? 'Pendientes' : 'Parciales'}
                    </h3>
                    <div className="ml-auto">
                        <Filter className="text-slate-400" size={20} />
                    </div>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-slate-400 w-5 h-5" />
                    <input
                        className="w-full pl-10 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm outline-none focus:bg-white focus:border-blue-600 transition-all"
                        placeholder="Item, cliente o monto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-2">
                {Object.entries(groupedTransactions).length === 0 && (
                    <div className="text-center text-slate-400 mt-10">No se encontraron ventas</div>
                )}

                {Object.entries(groupedTransactions).map(([dateLabel, group]) => (
                    <div key={dateLabel} className="mb-6">
                        <div className="mb-2 mt-4">
                            <h4 className="text-lg font-bold text-slate-700">{dateLabel}</h4>
                            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                                {group.count} Ventas • ${group.total.toLocaleString()}
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                            {group.items.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => onSelectTransaction(t)}
                                    className="w-full text-left p-4 hover:bg-slate-50 transition-colors flex items-start gap-3 active:bg-slate-100"
                                >
                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                                        <DollarSign size={20} />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <span className="font-bold text-slate-900 text-lg">${t.total.toLocaleString()}</span>
                                            <span className="text-xs text-slate-400 font-medium">
                                                {t.date?.seconds ? new Date(t.date.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                            </span>
                                        </div>

                                        <div className="text-xs text-slate-500 truncate mb-1">
                                            {t.items.length} items: {t.items.map(i => i.name).join(', ')}
                                        </div>

                                        <div className="flex items-center gap-1 text-sm font-semibold text-slate-700">
                                            <User size={14} className="text-slate-400" />
                                            <span className="truncate">{t.clientName}</span>
                                        </div>
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