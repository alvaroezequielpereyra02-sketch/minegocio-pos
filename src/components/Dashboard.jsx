import React from 'react';
import { Wallet, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function Dashboard({ balance, expenses, setIsExpenseModalOpen, handleDeleteExpense }) {
    return (
        <div className="flex flex-col h-full overflow-hidden pb-20 lg:pb-0">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <h2 className="text-xl font-bold text-slate-800">Balance Financiero</h2>
                <button onClick={() => setIsExpenseModalOpen(true)} className="bg-red-100 text-red-600 px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-bold hover:bg-red-200">
                    <Wallet size={16} /> Gasto
                </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-6">

                {/* CIERRE DE CAJA */}
                <div className="bg-slate-800 p-6 rounded-xl shadow-lg text-white">
                    <h3 className="text-sm font-bold text-slate-300 uppercase mb-4">Resumen del Día (Hoy)</h3>
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="bg-slate-700 p-3 rounded-lg">
                            <div className="text-xs text-slate-400 mb-1">Efectivo</div>
                            <div className="text-xl font-bold text-green-400">${balance.todayCash.toLocaleString()}</div>
                        </div>
                        <div className="bg-slate-700 p-3 rounded-lg">
                            <div className="text-xs text-slate-400 mb-1">Digital (Bancos)</div>
                            <div className="text-xl font-bold text-blue-400">${balance.todayDigital.toLocaleString()}</div>
                        </div>
                        <div className="bg-slate-700 p-3 rounded-lg border border-slate-500">
                            <div className="text-xs text-slate-400 mb-1">Total Vendido</div>
                            <div className="text-xl font-bold text-white">${balance.todayTotal.toLocaleString()}</div>
                        </div>
                    </div>
                </div>

                {/* GRÁFICO */}
                <div className="bg-white p-6 rounded-xl shadow-sm border h-80">
                    <h3 className="font-bold text-slate-700 mb-4">Ventas: Últimos 7 Días</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={balance.chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip formatter={(value) => [`$${value}`, 'Venta']} />
                            <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]}>
                                {balance.chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index === 6 ? '#16a34a' : '#2563eb'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* TARJETAS KPI */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-l-4 border-l-green-500">
                        <div className="text-slate-500 text-xs font-bold uppercase mb-1">Ventas Totales</div>
                        <div className="text-2xl font-bold text-green-700">${balance.salesPaid.toLocaleString()}</div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-l-4 border-l-blue-500">
                        <div className="text-slate-500 text-xs font-bold uppercase mb-1">Costo Mercadería</div>
                        <div className="text-2xl font-bold text-blue-600">-${balance.costOfGoodsSold.toLocaleString()}</div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-l-4 border-l-red-500">
                        <div className="text-slate-500 text-xs font-bold uppercase mb-1">Gastos Operativos</div>
                        <div className="text-2xl font-bold text-red-600">-${balance.totalExpenses.toLocaleString()}</div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-l-4 border-l-emerald-500">
                        <div className="text-slate-500 text-xs font-bold uppercase mb-1">Ganancia Neta</div>
                        <div className="text-2xl font-bold text-emerald-600">${balance.netProfit.toLocaleString()}</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border">
                        <h3 className="font-bold text-slate-700 mb-4">Stock por Categoría</h3>
                        <div className="space-y-3">{Object.entries(balance.categoryValues).map(([cat, val]) => (<div key={cat} className="flex justify-between items-center text-sm"><span className="text-slate-600">{cat}</span><span className="font-bold text-slate-800">${val.toLocaleString()}</span></div>))}</div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border">
                        <h3 className="font-bold text-slate-700 mb-4">Gastos Recientes</h3>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {expenses.map(exp => (
                                <div key={exp.id} className="flex justify-between text-sm p-2 hover:bg-slate-50 rounded">
                                    <div><div className="font-medium text-slate-700">{exp.description}</div><div className="text-xs text-slate-400">{new Date(exp.date?.seconds * 1000).toLocaleDateString()}</div></div>
                                    <div className="flex items-center gap-2"><span className="font-bold text-red-500">-${exp.amount}</span><button onClick={() => handleDeleteExpense(exp.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={12} /></button></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}