import React from 'react';
import { Wallet, Trash2, TrendingUp, PieChart as PieIcon } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
    PieChart, Pie, Legend
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function Dashboard({ balance, expenses, setIsExpenseModalOpen, handleDeleteExpense }) {

    // Renderizado custom para el Tooltip del gráfico
    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-2 border border-slate-200 shadow-lg rounded-lg text-xs">
                    <p className="font-bold">{payload[0].name}</p>
                    <p className="text-blue-600">${payload[0].value.toLocaleString()}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="flex flex-col h-full overflow-hidden pb-20 lg:pb-0 bg-slate-50 -m-4 p-4">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <TrendingUp className="text-blue-600" /> Balance Financiero
                </h2>
                <button onClick={() => setIsExpenseModalOpen(true)} className="bg-white border border-red-200 text-red-600 px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold hover:bg-red-50 shadow-sm transition-all active:scale-95">
                    <Wallet size={16} /> Registrar Gasto
                </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-1">

                {/* 1. RESUMEN DEL DÍA (Tarjetas oscuras) */}
                <div className="bg-slate-900 p-6 rounded-2xl shadow-xl text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase mb-4 tracking-wider">Cierre de Caja (Hoy)</h3>
                    <div className="grid grid-cols-3 gap-4 text-center relative z-10">
                        <div className="bg-slate-800/50 p-3 rounded-xl backdrop-blur-sm border border-slate-700">
                            <div className="text-[10px] text-slate-400 mb-1 uppercase">Efectivo</div>
                            <div className="text-lg font-bold text-emerald-400">${balance.todayCash.toLocaleString()}</div>
                        </div>
                        <div className="bg-slate-800/50 p-3 rounded-xl backdrop-blur-sm border border-slate-700">
                            <div className="text-[10px] text-slate-400 mb-1 uppercase">Digital</div>
                            <div className="text-lg font-bold text-blue-400">${balance.todayDigital.toLocaleString()}</div>
                        </div>
                        <div className="bg-slate-800/80 p-3 rounded-xl border border-blue-500/30 shadow-lg shadow-blue-500/10">
                            <div className="text-[10px] text-white mb-1 uppercase font-bold">Total Hoy</div>
                            <div className="text-xl font-black text-white">${balance.todayTotal.toLocaleString()}</div>
                        </div>
                    </div>
                </div>

                {/* 2. GRÁFICOS (Grid responsive) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* Gráfico de Barras: Ventas Semanales */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 h-80 flex flex-col">
                        <h3 className="font-bold text-slate-700 mb-4 text-sm">Ventas: Últimos 7 Días</h3>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={balance.chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} />
                                    <Tooltip cursor={{ fill: '#f8fafc' }} content={<CustomTooltip />} />
                                    <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                                        {balance.chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={index === 6 ? '#22c55e' : '#3b82f6'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Gráfico de Torta: Ventas por Categoría */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 h-80 flex flex-col">
                        <h3 className="font-bold text-slate-700 mb-4 text-sm flex items-center gap-2">
                            <PieIcon size={16} className="text-purple-500" /> Ventas por Categoría
                        </h3>
                        <div className="flex-1 min-h-0">
                            {balance.salesByCategory.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={balance.salesByCategory}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {balance.salesByCategory.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend verticalAlign="middle" align="right" layout="vertical" iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                                    Sin datos de categorías
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 3. KPIS GENERALES */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-l-4 border-l-green-500">
                        <div className="text-slate-400 text-[10px] font-bold uppercase mb-1">Ventas Totales</div>
                        <div className="text-lg font-bold text-green-700">${balance.salesPaid.toLocaleString()}</div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-l-4 border-l-blue-500">
                        <div className="text-slate-400 text-[10px] font-bold uppercase mb-1">Costo Mercadería</div>
                        <div className="text-lg font-bold text-blue-600">-${balance.costOfGoodsSold.toLocaleString()}</div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-l-4 border-l-red-500">
                        <div className="text-slate-400 text-[10px] font-bold uppercase mb-1">Gastos Operativos</div>
                        <div className="text-lg font-bold text-red-600">-${balance.totalExpenses.toLocaleString()}</div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-l-4 border-l-emerald-500">
                        <div className="text-slate-400 text-[10px] font-bold uppercase mb-1">Ganancia Neta</div>
                        <div className="text-xl font-bold text-emerald-600">${balance.netProfit.toLocaleString()}</div>
                    </div>
                </div>

                {/* 4. LISTA DE GASTOS */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-700 mb-4 text-sm">Gastos Recientes</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                        {expenses.length === 0 && <div className="text-slate-400 text-xs text-center py-4">No hay gastos registrados</div>}
                        {expenses.map(exp => (
                            <div key={exp.id} className="flex justify-between items-center text-sm p-3 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-100 transition-colors">
                                <div>
                                    <div className="font-bold text-slate-700">{exp.description}</div>
                                    <div className="text-xs text-slate-400">{new Date(exp.date?.seconds * 1000).toLocaleDateString()}</div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-red-600">-${exp.amount.toLocaleString()}</span>
                                    <button onClick={() => handleDeleteExpense(exp.id)} className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1 rounded transition-colors"><Trash2 size={14} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}