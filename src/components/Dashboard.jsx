import React from 'react';
import { Wallet, Trash2, TrendingUp, PieChart as PieIcon, Calendar } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
    PieChart, Pie, Legend
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

export default function Dashboard({ balance, expenses, setIsExpenseModalOpen, handleDeleteExpense, dateRange, setDateRange }) {

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-2 border border-slate-200 shadow-lg rounded-lg text-xs z-50">
                    <p className="font-bold mb-1">{payload[0].name}</p>
                    <p className="text-blue-600 font-bold">${payload[0].value.toLocaleString()}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="flex flex-col h-full overflow-hidden pb-24 lg:pb-0 bg-slate-50 -m-4 p-4">

            {/* Header con Selector de Fecha */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 flex-shrink-0">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <TrendingUp className="text-blue-600" /> Balance
                </h2>

                <div className="flex gap-2 w-full sm:w-auto">
                    {/* Selector de Rango */}
                    <div className="flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
                        <button
                            onClick={() => setDateRange('week')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${dateRange === 'week' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            7 Días
                        </button>
                        <button
                            onClick={() => setDateRange('month')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${dateRange === 'month' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            30 Días
                        </button>
                    </div>

                    <button onClick={() => setIsExpenseModalOpen(true)} className="ml-auto bg-red-50 text-red-600 border border-red-200 px-3 py-2 rounded-xl flex items-center gap-2 text-xs font-bold hover:bg-red-100 shadow-sm transition-all active:scale-95">
                        <Wallet size={14} /> - Gasto
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-1 pb-4">

                {/* 1. RESUMEN DEL DÍA */}
                <div className="bg-slate-900 p-5 rounded-2xl shadow-xl text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>
                    <div className="flex justify-between items-end mb-4 relative z-10">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hoy</h3>
                        <span className="text-2xl font-black text-white">${balance.todayTotal.toLocaleString()}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-center relative z-10">
                        <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                            <div className="text-[10px] text-slate-400 uppercase">Efectivo</div>
                            <div className="text-sm font-bold text-emerald-400">${balance.todayCash.toLocaleString()}</div>
                        </div>
                        <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                            <div className="text-[10px] text-slate-400 uppercase">Digital</div>
                            <div className="text-sm font-bold text-blue-400">${balance.todayDigital.toLocaleString()}</div>
                        </div>
                    </div>
                </div>

                {/* 2. GRÁFICOS (Layout Vertical en Móvil) */}
                <div className="flex flex-col lg:flex-row gap-6">

                    {/* Barras */}
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col min-h-[300px] flex-1">
                        <h3 className="font-bold text-slate-700 mb-4 text-xs uppercase tracking-wide">Evolución de Ventas</h3>
                        <div className="flex-1 w-full min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={balance.chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v / 1000}k`} width={35} />
                                    <Tooltip cursor={{ fill: '#f8fafc' }} content={<CustomTooltip />} />
                                    <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                                        {balance.chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={index === balance.chartData.length - 1 ? '#10b981' : '#3b82f6'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Torta (Pie Chart) - VISIBLE EN MÓVIL AHORA */}
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col min-h-[300px] lg:w-1/3">
                        <h3 className="font-bold text-slate-700 mb-2 text-xs uppercase tracking-wide flex items-center gap-2">
                            <PieIcon size={14} className="text-purple-500" /> Por Categoría
                        </h3>
                        <div className="flex-1 w-full min-h-0 relative">
                            {balance.salesByCategory.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={balance.salesByCategory}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={70}
                                            paddingAngle={4}
                                            dataKey="value"
                                        >
                                            {balance.salesByCategory.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend
                                            verticalAlign="bottom"
                                            align="center"
                                            iconSize={8}
                                            wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }}
                                            layout="horizontal"
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300">
                                    <PieIcon size={32} className="mb-2 opacity-50" />
                                    <span className="text-xs">Sin datos en este periodo</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 3. KPIS DEL PERIODO */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-3 rounded-xl shadow-sm border border-l-4 border-l-green-500">
                        <div className="text-slate-400 text-[10px] font-bold uppercase">Ventas</div>
                        <div className="text-base font-bold text-green-700">${balance.periodSales.toLocaleString()}</div>
                    </div>
                    <div className="bg-white p-3 rounded-xl shadow-sm border border-l-4 border-l-red-500">
                        <div className="text-slate-400 text-[10px] font-bold uppercase">Gastos</div>
                        <div className="text-base font-bold text-red-600">-${balance.periodExpenses.toLocaleString()}</div>
                    </div>
                    <div className="bg-white p-3 rounded-xl shadow-sm border border-l-4 border-l-blue-500">
                        <div className="text-slate-400 text-[10px] font-bold uppercase">Costo</div>
                        <div className="text-base font-bold text-blue-600">-${balance.periodCost.toLocaleString()}</div>
                    </div>
                    <div className="bg-white p-3 rounded-xl shadow-sm border border-l-4 border-l-emerald-500">
                        <div className="text-slate-400 text-[10px] font-bold uppercase">Neto</div>
                        <div className={`text-base font-bold ${balance.periodNet >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>${balance.periodNet.toLocaleString()}</div>
                    </div>
                </div>

                {/* 4. LISTA DE GASTOS */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-700 mb-3 text-xs uppercase tracking-wide">Gastos Recientes</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                        {expenses.length === 0 && <div className="text-slate-400 text-xs text-center py-4 italic">No hay gastos registrados</div>}
                        {expenses.map(exp => (
                            <div key={exp.id} className="flex justify-between items-center text-xs p-2.5 bg-slate-50/50 rounded-lg border border-slate-100">
                                <div>
                                    <div className="font-bold text-slate-700">{exp.description}</div>
                                    <div className="text-[10px] text-slate-400">{new Date(exp.date?.seconds * 1000).toLocaleDateString()}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-red-600">-${exp.amount.toLocaleString()}</span>
                                    <button onClick={() => handleDeleteExpense(exp.id)} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}